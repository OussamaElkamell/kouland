import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  PERMISSION_AREAS,
  type AccessMap,
  type ApiErrorBody,
  type InvitedUser,
  type LinkReceipt,
  type Ref,
  type User,
  createUserSchema,
  updateUserSchema,
} from "@kouland/contracts";
import type { z } from "zod";
import type { AuthUser } from "../auth/auth-user";
import { LinkService } from "../auth/link.service";
import { SessionService } from "../auth/session.service";
import { isUniqueViolation, notFound, taken } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

const SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  allPlatforms: true,
  locale: true,
  lastLoginAt: true,
  createdAt: true,
  passwordHash: true,
  permissions: { select: { area: true, level: true } },
  platforms: { select: { platformId: true } },
} satisfies Prisma.UserSelect;

type Row = Prisma.UserGetPayload<{ select: typeof SELECT }>;

/** The password hash never leaves this function: only whether one exists. */
function toUser({ permissions, platforms, lastLoginAt, createdAt, locale, passwordHash, ...row }: Row): User {
  const access: AccessMap = { CUSTOMERS: null, SALES: null };
  for (const permission of permissions) access[permission.area] = permission.level;
  return {
    ...row,
    locale: locale === "fr" || locale === "es" ? locale : "en",
    access,
    platformIds: platforms.map((platform) => platform.platformId),
    lastLoginAt: lastLoginAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    invitationPending: passwordHash === null,
  };
}

const badRequest = (field: string, code: string, message: string) => {
  const body: ApiErrorBody = { statusCode: 400, message, fieldErrors: { [field]: [code] } };
  return new BadRequestException(body);
};

/**
 * CRM accounts, managed by administrators. Administrators always have every area and platform; managers and
 * employees have what is granted here, and changes apply on their next request.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly links: LinkService,
  ) {}

  async list(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: SELECT });
    return rows.map(toUser);
  }

  /** Active accounts that can work on sales, for the "owner" of an opportunity. */
  async assignable(): Promise<Ref[]> {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: "ADMIN" }, { permissions: { some: { area: "SALES", level: { in: ["EDIT", "MANAGE"] } } } }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  /** Creates the account without a password and emails the person an invitation to choose one. */
  async create(actor: AuthUser, input: z.output<typeof createUserSchema>): Promise<InvitedUser> {
    await this.checkPlatforms(input.platformIds);
    const isAdmin = input.role === "ADMIN";
    try {
      const row = await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          locale: input.locale,
          allPlatforms: isAdmin || input.allPlatforms,
          permissions: { create: isAdmin ? [] : permissionRows(input.access) },
          platforms: { create: isAdmin ? [] : input.platformIds.map((platformId) => ({ platformId })) },
        },
        select: SELECT,
      });
      const invitation = await this.links.issue(row.id, "INVITE", actor.id);
      return { user: toUser(row), invitation };
    } catch (error) {
      if (isUniqueViolation(error, "email")) throw taken("email", "An account with this email already exists.");
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, input: z.output<typeof updateUserSchema>): Promise<User> {
    const current = await this.prisma.user.findUnique({ where: { id }, select: SELECT });
    if (!current) throw notFound("Account");
    const role = input.role ?? current.role;
    const isActive = input.isActive ?? current.isActive;

    if (id === actor.id && (role !== "ADMIN" || !isActive)) {
      throw badRequest("role", "ownAccount", "You cannot remove your own administrator access.");
    }
    if (current.role === "ADMIN" && current.isActive && (role !== "ADMIN" || !isActive)) {
      const otherAdmins = await this.prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
      if (otherAdmins === 0) throw badRequest("role", "lastAdmin", "The CRM needs at least one active administrator.");
    }
    // A role change must not leave levels the new role cannot have (an employee cannot be given MANAGE).
    const access = input.access ?? (input.role ? toUser(current).access : undefined);
    if (access) {
      const parsed = updateUserSchema.safeParse({ role, access });
      if (!parsed.success) throw badRequest("access", "invalid", "This role cannot have this access level.");
    }
    if (input.platformIds) await this.checkPlatforms(input.platformIds);

    const isAdmin = role === "ADMIN";
    const row = await this.prisma.$transaction(async (tx) => {
      if (access || isAdmin) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        if (!isAdmin && access) await tx.userPermission.createMany({ data: permissionRows(access).map((p) => ({ ...p, userId: id })) });
      }
      if (input.platformIds || isAdmin) {
        await tx.userPlatform.deleteMany({ where: { userId: id } });
        if (!isAdmin && input.platformIds) {
          await tx.userPlatform.createMany({ data: input.platformIds.map((platformId) => ({ userId: id, platformId })) });
        }
      }
      return tx.user.update({
        where: { id },
        data: {
          name: input.name,
          role,
          isActive,
          locale: input.locale,
          allPlatforms: isAdmin ? true : input.allPlatforms,
        },
        select: SELECT,
      });
    });
    if (!isActive) await this.sessions.destroyAllFor(id);
    return toUser(row);
  }

  /**
   * Emails the person a new link: an invitation again while they have never chosen a password, otherwise a link to
   * choose a new password. Their current password keeps working until the link is used.
   */
  async sendLink(actor: AuthUser, id: string): Promise<LinkReceipt> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { isActive: true, passwordHash: true } });
    if (!user) throw notFound("Account");
    if (!user.isActive) throw badRequest("isActive", "inactive", "Reactivate the account before sending it a link.");
    return this.links.issue(id, user.passwordHash ? "RESET_PASSWORD" : "INVITE", actor.id);
  }

  private async checkPlatforms(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await this.prisma.platform.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw badRequest("platformIds", "invalid", "One of the platforms does not exist.");
  }
}

function permissionRows(access: AccessMap) {
  return PERMISSION_AREAS.flatMap((area) => (access[area] ? [{ area, level: access[area]! }] : []));
}
