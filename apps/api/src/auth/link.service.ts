import { GoneException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { crmLocaleSchema, type ApiErrorBody, type LinkInfo, type LinkReceipt, type SessionUser, type TokenPurpose } from "@kouland/contracts";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { buildLinkEmail } from "./link-email";
import { hashPassword } from "./password";
import { SessionService } from "./session.service";

/** How long each kind of link works. */
const VALID_HOURS: Record<TokenPurpose, number> = { INVITE: 7 * 24, RESET_PASSWORD: 24 };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * One-time links emailed to people: the invitation to a new account (choose a first password) and the password
 * reset link an administrator can send. The link opens /admin/link on the website.
 */
@Injectable()
export class LinkService {
  private readonly logger = new Logger(LinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailSender,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Makes a new link for the account (older unused links stop working) and emails it. The link itself is only
   * returned when the email was not sent, so the administrator can pass it on another way.
   */
  async issue(userId: string, purpose: TokenPurpose, issuedById: string | null): Promise<LinkReceipt> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, locale: true } });
    const issuer = issuedById ? await this.prisma.user.findUnique({ where: { id: issuedById }, select: { name: true } }) : null;
    const token = randomBytes(32).toString("base64url");
    const validHours = VALID_HOURS[purpose];

    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({ where: { userId, usedAt: null } }),
      this.prisma.userToken.create({
        data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + validHours * 3_600_000), createdById: issuedById },
      }),
    ]);

    const link = `${this.appUrl()}/admin/link?token=${token}`;
    const email = buildLinkEmail({
      purpose,
      locale: crmLocaleSchema.catch("en").parse(user.locale),
      name: user.name,
      invitedBy: issuer?.name ?? null,
      link,
      validHours,
    });

    if (!this.config.get<string>("BREVO_API_KEY")) {
      this.logger.warn(`${purpose} link for ${user.email} not emailed: BREVO_API_KEY is not set.`);
      return { emailSent: false, link };
    }
    try {
      await this.mail.send({
        to: [{ email: user.email, name: user.name }],
        subject: email.subject,
        html: email.html,
        text: email.text,
        tag: purpose === "INVITE" ? "crm-invitation" : "crm-password-reset",
      });
      return { emailSent: true, link: null };
    } catch (error) {
      this.logger.error(`${purpose} link for ${user.email} could not be emailed: ${error instanceof Error ? error.message : String(error)}`);
      return { emailSent: false, link };
    }
  }

  /** Whose link this is, so the page can greet them. 410 when it is unknown, used, expired or the account is off. */
  async info(token: string): Promise<LinkInfo> {
    const found = await this.find(token);
    return {
      purpose: found.purpose,
      email: found.user.email,
      name: found.user.name,
      locale: crmLocaleSchema.catch("en").parse(found.user.locale),
    };
  }

  /** Sets the password, uses up the link, ends other sessions and signs the person in. */
  async use(token: string, password: string, userAgent: string | undefined, response: Response): Promise<SessionUser> {
    const found = await this.find(token);
    const passwordHash = await hashPassword(password);
    const claimed = await this.prisma.$transaction(async (tx) => {
      // Only one request can use a link, even if two arrive at the same time.
      const { count } = await tx.userToken.updateMany({ where: { id: found.id, usedAt: null }, data: { usedAt: new Date() } });
      if (count === 0) return false;
      await tx.user.update({ where: { id: found.userId }, data: { passwordHash, lastLoginAt: new Date() } });
      await tx.userToken.deleteMany({ where: { userId: found.userId, usedAt: null } });
      await tx.session.deleteMany({ where: { userId: found.userId } });
      return true;
    });
    if (!claimed) throw expired();
    const user = await this.sessions.create(found.userId, userAgent, response);
    return this.auth.me(user);
  }

  private async find(token: string) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw expired();
    const found = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { email: true, name: true, locale: true, isActive: true } } },
    });
    if (!found || found.usedAt || found.expiresAt <= new Date() || !found.user.isActive) throw expired();
    return found;
  }

  /** The website's address, where /admin/link lives: APP_URL, else the first allowed website origin (CORS_ORIGINS). */
  private appUrl(): string {
    const configured = this.config.get<string>("APP_URL") || (this.config.get<string>("CORS_ORIGINS") ?? "").split(",")[0];
    return configured?.trim().replace(/\/+$/, "") || "http://localhost:3100";
  }
}

function expired() {
  const body: ApiErrorBody = { statusCode: 410, message: "This link has expired or was already used. Ask your administrator for a new one." };
  return new GoneException(body);
}
