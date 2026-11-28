import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { CustomerEmails, EmailConnection, EmailMessage, EmailProvider, sendEmailSchema } from "@kouland/contracts";
import type { z } from "zod";
import type { AuthUser } from "../auth/auth-user";
import { ActivityService } from "../customers/activity.service";
import { CustomerAccess } from "../customers/customer-access";
import { decryptSecret, encryptSecret, safeEqual, sign } from "../common/secrets";
import { publicApiUrl } from "../common/urls";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleMail, MailboxAuthError, MicrosoftMail, type MailProvider } from "./providers";

const STATE_TTL_MS = 10 * 60_000;
const SEARCH_LIMIT = 25;

/**
 * Each person's own mailbox (Google Workspace or Microsoft 365): connect it, see the emails exchanged with a
 * customer, read one, send or reply. Mail is read live from the provider; only a reference to emails sent from the
 * CRM is kept, in the customer's history.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  readonly providers: Record<EmailProvider, MailProvider> = { GOOGLE: new GoogleMail(), MICROSOFT: new MicrosoftMail() };

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CustomerAccess,
    private readonly activity: ActivityService,
  ) {}

  provider(slug: string): MailProvider {
    const id = slug.toUpperCase() as EmailProvider;
    const provider = this.providers[id];
    if (!provider) throw new NotFoundException("Unknown email provider.");
    if (!provider.configured()) throw new BadRequestException(`${id === "GOOGLE" ? "Google" : "Microsoft"} mailboxes are not set up on the server.`);
    return provider;
  }

  redirectUri(provider: EmailProvider): string {
    return `${publicApiUrl()}/api/email/oauth/${provider.toLowerCase()}/callback`;
  }

  async connection(user: AuthUser): Promise<EmailConnection> {
    const row = await this.prisma.emailConnection.findUnique({ where: { userId: user.id }, select: { provider: true, email: true } });
    return {
      provider: row?.provider ?? null,
      email: row?.email ?? null,
      available: (Object.values(this.providers) as MailProvider[]).filter((p) => p.configured()).map((p) => p.id),
    };
  }

  /** The provider's consent page. `state` ties the answer to this person and expires in 10 minutes. */
  startUrl(user: AuthUser, slug: string): string {
    const provider = this.provider(slug);
    const payload = Buffer.from(JSON.stringify({ u: user.id, p: provider.id, n: randomBytes(8).toString("hex"), e: Date.now() + STATE_TTL_MS })).toString("base64url");
    return provider.authorizeUrl(`${payload}.${sign(payload)}`, this.redirectUri(provider.id));
  }

  async finish(user: AuthUser, slug: string, code: string | undefined, state: string | undefined): Promise<void> {
    const provider = this.provider(slug);
    const [payload, signature] = (state ?? "").split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload))) throw new BadRequestException("Invalid sign-in state.");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u: string; p: string; e: number };
    if (data.u !== user.id || data.p !== provider.id || data.e < Date.now()) throw new BadRequestException("This sign-in link expired. Try again.");
    if (!code) throw new BadRequestException("The mailbox was not connected.");

    const tokens = await provider.exchange(code, this.redirectUri(provider.id));
    if (!tokens.refreshToken) throw new BadRequestException("The provider gave no lasting access. Remove the CRM from your account's connected apps and try again.");
    const values = {
      provider: provider.id,
      email: tokens.email,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: encryptSecret(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    };
    await this.prisma.emailConnection.upsert({ where: { userId: user.id }, create: { userId: user.id, ...values }, update: values });
  }

  async disconnect(user: AuthUser): Promise<void> {
    await this.prisma.emailConnection.deleteMany({ where: { userId: user.id } });
  }

  /** A valid access token for the person's mailbox, refreshed when it is about to expire; null when none is connected. */
  private async mailbox(user: AuthUser): Promise<{ provider: MailProvider; token: string; email: string } | null> {
    const row = await this.prisma.emailConnection.findUnique({ where: { userId: user.id } });
    if (!row) return null;
    const provider = this.providers[row.provider];
    if (row.expiresAt.getTime() > Date.now() + 60_000) return { provider, token: decryptSecret(row.accessTokenEnc), email: row.email };
    try {
      const tokens = await provider.refresh(decryptSecret(row.refreshTokenEnc));
      await this.prisma.emailConnection.update({
        where: { userId: user.id },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          expiresAt: tokens.expiresAt,
          ...(tokens.refreshToken ? { refreshTokenEnc: encryptSecret(tokens.refreshToken) } : {}),
        },
      });
      return { provider, token: tokens.accessToken, email: row.email };
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (error instanceof MailboxAuthError) return new ConflictException({ statusCode: 409, message: "Your mailbox needs to be connected again (Account page).", fieldErrors: { mailbox: ["reconnect"] } });
    return error;
  }

  /** The customer's own address and their contacts'. */
  private async addresses(customerId: string): Promise<string[]> {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { email: true, contacts: { select: { email: true } } } });
    return [...new Set([customer.email, ...customer.contacts.map((c) => c.email)].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))].slice(0, 10);
  }

  async forCustomer(user: AuthUser, customerId: string): Promise<CustomerEmails> {
    await this.access.visibleCustomer(user, customerId);
    const addresses = await this.addresses(customerId);
    const box = await this.mailbox(user);
    if (!box) return { connected: false, addresses, items: [] };
    if (addresses.length === 0) return { connected: true, addresses, items: [] };
    try {
      return { connected: true, addresses, items: await box.provider.search(box.token, box.email, addresses, SEARCH_LIMIT) };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async message(user: AuthUser, id: string): Promise<EmailMessage> {
    const box = await this.mailbox(user);
    if (!box) throw new ConflictException("Connect your mailbox first.");
    try {
      const { messageIdHeader: _m, references: _r, ...message } = await box.provider.get(box.token, box.email, id);
      return message;
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** Sends (or replies) from the person's mailbox, and notes it in the customer's history. */
  async send(user: AuthUser, customerId: string, input: z.output<typeof sendEmailSchema>): Promise<void> {
    await this.access.visibleCustomer(user, customerId);
    const box = await this.mailbox(user);
    if (!box) throw new ConflictException("Connect your mailbox first.");
    try {
      const original = input.replyToId ? await box.provider.get(box.token, box.email, input.replyToId) : null;
      await box.provider.send(box.token, {
        from: box.email,
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        body: input.body,
        replyTo: original ? { id: original.id, threadId: original.threadId, messageIdHeader: original.messageIdHeader, references: original.references } : undefined,
      });
    } catch (error) {
      throw this.translate(error);
    }
    await this.activity.record({
      customerId,
      type: "EMAIL_SENT",
      userId: user.id,
      data: { subject: input.subject, to: input.to, from: box.email, reply: Boolean(input.replyToId) },
    });
  }
}
