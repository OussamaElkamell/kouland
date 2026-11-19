import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import type { AccessMap } from "@kouland/contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./auth-user";

export const SESSION_COOKIE = "kouland_session";
const SESSION_DAYS = 14;
/** lastSeenAt is written at most this often, so every request does not cost a database write. */
const TOUCH_EVERY_MS = 5 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Reads one cookie from the Cookie header (no cookie-parser needed for a single cookie). */
export function readCookie(header: string | string[] | undefined, name: string): string | undefined {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

/**
 * Database sessions: the browser keeps a random token in an httpOnly cookie, the database keeps its hash.
 * Signing out, deactivating an account or changing a password ends sessions immediately.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Starts a session, sets the cookie and returns the signed-in account. */
  async create(userId: string, userAgent: string | undefined, response: Response): Promise<AuthUser> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.prisma.session.create({
      data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) },
    });
    response.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(response), expires: expiresAt });
    const user = await this.resolveToken(token);
    if (!user) throw new Error("New session could not be read back");
    return user;
  }

  /** The account behind the request's cookie, or null when there is none, it expired or the account is inactive. */
  async resolve(request: Pick<Request, "headers">): Promise<AuthUser | null> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    return token ? this.resolveToken(token) : null;
  }

  private async resolveToken(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { permissions: true, platforms: { select: { platformId: true } } } } },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;

    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    const { user } = session;
    const access: AccessMap = { CUSTOMERS: null, SALES: null };
    for (const permission of user.permissions) access[permission.area] = permission.level;
    if (user.role === "ADMIN") {
      access.CUSTOMERS = "MANAGE";
      access.SALES = "MANAGE";
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: user.locale,
      access,
      allPlatforms: user.role === "ADMIN" || user.allPlatforms,
      platformIds: user.platforms.map((platform) => platform.platformId),
      sessionId: session.id,
    };
  }

  async destroy(sessionId: string, response: Response): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
    this.clearCookie(response);
  }

  /** Ends every session of an account, except optionally the current one. */
  async destroyAllFor(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
  }

  clearCookie(response: Response): void {
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(response));
  }

  /**
   * httpOnly so scripts cannot read it; SameSite=Lax so other sites cannot send it with their requests. The website
   * (kouland.com) and the API (api.kouland.com) are the same site, so the browser sends it to the API. Set
   * COOKIE_DOMAIN=kouland.com to share it with the website too.
   * Secure (HTTPS only) when the request came over HTTPS, as Express sees it behind the host's proxy (TRUST_PROXY);
   * COOKIE_SECURE=true or false forces it.
   */
  private cookieOptions(response: Response): CookieOptions {
    const domain = this.config.get<string>("COOKIE_DOMAIN") || undefined;
    const forced = this.config.get<string>("COOKIE_SECURE");
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: forced === "true" ? true : forced === "false" ? false : Boolean(response.req?.secure),
      path: "/",
      ...(domain ? { domain } : {}),
    };
  }
}
