import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { crmLocaleSchema, type ApiErrorBody, type ChangePassword, type SessionUser, type UpdateProfileInput } from "@kouland/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { platformScope, type AuthUser } from "./auth-user";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /** The account for these credentials, or a 401 that does not say which part was wrong. */
  async checkCredentials(email: string, password: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, isActive: true } });
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()));
    if (!user || !valid || !user.isActive) throw new UnauthorizedException("Wrong email or password.");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { id: user.id };
  }

  /** The signed-in account with the active platforms it may work in. */
  async me(user: AuthUser): Promise<SessionUser> {
    const scope = platformScope(user);
    const platforms = await this.prisma.platform.findMany({
      where: { isActive: true, ...(scope ? { id: { in: scope } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, color: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: crmLocaleSchema.catch("en").parse(user.locale),
      access: user.access,
      allPlatforms: user.allPlatforms,
      platforms,
    };
  }

  async updateProfile(user: AuthUser, input: UpdateProfileInput): Promise<SessionUser> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { name: input.name, locale: input.locale },
      select: { name: true, locale: true },
    });
    return this.me({ ...user, ...updated });
  }

  /** Changes the account's password and signs out its other browsers. */
  async changePassword(user: AuthUser, input: ChangePassword): Promise<void> {
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!account.passwordHash || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
      const body: ApiErrorBody = {
        statusCode: 400,
        message: "Your current password is not correct.",
        fieldErrors: { currentPassword: ["wrongPassword"] },
      };
      throw new BadRequestException(body);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await this.sessions.destroyAllFor(user.id, user.sessionId);
  }
}
