import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createPlatformSchema, updatePlatformSchema, type Platform } from "@kouland/contracts";
import type { z } from "zod";
import { platformScope, type AuthUser } from "../auth/auth-user";
import { isUniqueViolation, notFound, taken } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

const SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  websiteUrl: true,
  color: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  _count: { select: { customers: true, opportunities: true } },
} satisfies Prisma.PlatformSelect;

type Row = Prisma.PlatformGetPayload<{ select: typeof SELECT }>;

const toPlatform = ({ _count, createdAt, ...row }: Row): Platform => ({
  ...row,
  customerCount: _count.customers,
  opportunityCount: _count.opportunities,
  createdAt: createdAt.toISOString(),
});

/** The configured platform sections. Nothing in the CRM depends on a platform's name. */
@Injectable()
export class PlatformsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Platforms the account may see. Inactive ones are listed for administrators (to reactivate them) only. */
  async list(user: AuthUser, includeInactive: boolean): Promise<Platform[]> {
    const scope = platformScope(user);
    const rows = await this.prisma.platform.findMany({
      where: {
        ...(includeInactive && user.role === "ADMIN" ? {} : { isActive: true }),
        ...(scope ? { id: { in: scope } } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: SELECT,
    });
    return rows.map(toPlatform);
  }

  async create(input: z.output<typeof createPlatformSchema>): Promise<Platform> {
    try {
      return toPlatform(await this.prisma.platform.create({ data: input, select: SELECT }));
    } catch (error) {
      throw this.uniqueError(error);
    }
  }

  async update(id: string, input: z.output<typeof updatePlatformSchema>): Promise<Platform> {
    if (!(await this.prisma.platform.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Platform");
    try {
      return toPlatform(await this.prisma.platform.update({ where: { id }, data: input, select: SELECT }));
    } catch (error) {
      throw this.uniqueError(error);
    }
  }

  private uniqueError(error: unknown): unknown {
    if (isUniqueViolation(error, "name")) return taken("name", "A platform with this name already exists.");
    if (isUniqueViolation(error, "slug")) return taken("slug", "A platform with this address already exists.");
    return error;
  }
}
