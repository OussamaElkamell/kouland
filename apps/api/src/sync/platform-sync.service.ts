import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";
import { webhookPayloadSchema, type WebhookCustomer, type WebhookPayload, type WebhookReceipt } from "@kouland/contracts";
import { ActivityService } from "../customers/activity.service";
import { findCustomerByPhone } from "../common/phone-match";
import { decryptSecret, safeEqual } from "../common/secrets";
import { isUniqueViolation } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

/** A signed call older or newer than this is refused, so a captured call cannot be replayed later. */
const TOLERANCE_SECONDS = 5 * 60;

/** Customer fields a platform may fill in. */
const FILLABLE = ["firstName", "lastName", "companyName", "email", "phone", "city", "country"] as const;

type Platform = { id: string; name: string };

/** `t=1700000000,v1=<hex>` → its parts. */
export function parseSignature(header: string | undefined): { timestamp: number; signatures: string[] } | null {
  if (!header) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === "t") timestamp = Number(value);
    if (name === "v1" && value) signatures.push(value);
  }
  return Number.isFinite(timestamp) && signatures.length > 0 ? { timestamp, signatures } : null;
}

export function signWebhook(secret: string, timestamp: number, rawBody: string | Buffer): string {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

/**
 * Receives platforms' webhook calls: checks the signature, applies each event once, and records what happened.
 *
 * Customers are matched by the platform's own id first, then by email, then by phone, so a customer is never
 * duplicated when the CRM can recognise them. A matched customer only gets the fields the CRM is missing: what
 * staff typed in the CRM is never overwritten by a platform.
 */
@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async receive(platformId: string, rawBody: Buffer | undefined, signatureHeader: string | undefined, now = new Date()): Promise<WebhookReceipt> {
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
      select: { id: true, name: true, isActive: true, webhookEnabled: true, webhookSecretEnc: true },
    });
    if (!platform) throw new NotFoundException("Unknown platform.");
    if (!platform.isActive || !platform.webhookEnabled || !platform.webhookSecretEnc) {
      throw new ForbiddenException("This platform's webhook is turned off in the CRM.");
    }
    if (!rawBody?.length) throw new BadRequestException("Empty body.");

    const signature = parseSignature(signatureHeader);
    if (!signature) throw new UnauthorizedException("Missing or malformed X-Kouland-Signature header.");
    if (Math.abs(now.getTime() / 1000 - signature.timestamp) > TOLERANCE_SECONDS) {
      throw new UnauthorizedException("Signature timestamp is too old or in the future. Check the platform's clock.");
    }
    const expected = signWebhook(decryptSecret(platform.webhookSecretEnc), signature.timestamp, rawBody);
    if (!signature.signatures.some((candidate) => safeEqual(candidate, expected))) {
      throw new UnauthorizedException("Invalid signature.");
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new BadRequestException("The body is not valid JSON.");
    }
    const parsed = webhookPayloadSchema.safeParse(json);
    const eventId = typeof (json as { id?: unknown })?.id === "string" || typeof (json as { id?: unknown })?.id === "number" ? String((json as { id: unknown }).id).slice(0, 120) : null;
    const type = typeof (json as { type?: unknown })?.type === "string" ? String((json as { type: unknown }).type).slice(0, 60) : "unknown";

    if (await this.alreadyReceived(platform.id, eventId)) return { received: true, status: "DUPLICATE", customerId: null };
    await this.prisma.platform.update({ where: { id: platform.id }, data: { lastWebhookAt: now } });

    if (!parsed.success) {
      const error = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ").slice(0, 1000);
      if (eventId) await this.log(platform.id, { eventId, type, status: "FAILED", error, payload: json });
      throw new BadRequestException({ statusCode: 400, message: `The event is not valid: ${error}` });
    }

    try {
      const result = await this.apply(platform, parsed.data);
      await this.log(platform.id, { eventId: parsed.data.id, type, status: "PROCESSED", payload: json, ...result });
      return { received: true, status: "PROCESSED", customerId: result.customerId };
    } catch (error) {
      if (isUniqueViolation(error)) return { received: true, status: "DUPLICATE", customerId: null };
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Platform ${platform.name} event ${parsed.data.id} failed: ${message}`);
      await this.log(platform.id, { eventId: parsed.data.id, type, status: "FAILED", error: message.slice(0, 1000), payload: json }).catch(() => undefined);
      return { received: true, status: "FAILED", customerId: null };
    }
  }

  private async alreadyReceived(platformId: string, eventId: string | null): Promise<boolean> {
    if (!eventId) return false;
    const existing = await this.prisma.platformEvent.findUnique({ where: { platformId_eventId: { platformId, eventId } }, select: { status: true } });
    if (existing?.status === "FAILED") {
      // A failed event may be sent again once the platform fixed it: forget the failure and try again.
      await this.prisma.platformEvent.delete({ where: { platformId_eventId: { platformId, eventId } } });
      return false;
    }
    return Boolean(existing);
  }

  private async log(
    platformId: string,
    entry: { eventId: string; type: string; status: "PROCESSED" | "FAILED"; error?: string; payload: unknown; customerId?: string | null; created?: boolean },
  ) {
    await this.prisma.platformEvent.create({
      data: {
        platformId,
        eventId: entry.eventId,
        type: entry.type,
        status: entry.status,
        error: entry.error ?? null,
        customerId: entry.customerId ?? null,
        created: entry.created ?? false,
        payload: (entry.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async apply(platform: Platform, payload: WebhookPayload): Promise<{ customerId: string | null; created: boolean }> {
    if (payload.type === "ping") return { customerId: null, created: false };
    const { customerId, created } = await this.matchOrCreate(platform, payload.customer);
    if (payload.type === "event") {
      const occurredAt = payload.event.occurredAt ? new Date(payload.event.occurredAt) : null;
      await this.prisma.activity.create({
        data: {
          customerId,
          type: "PLATFORM_EVENT",
          body: payload.event.details,
          data: {
            platform: platform.name,
            platformId: platform.id,
            name: payload.event.name,
            title: payload.event.title,
            url: payload.event.url ?? null,
          },
          // Ordered in the history by when it happened on the platform (never in the future).
          ...(occurredAt && occurredAt.getTime() <= Date.now() ? { createdAt: occurredAt } : {}),
        },
      });
    }
    return { customerId, created };
  }

  /** The customer this platform record is, linked to the platform; created when the CRM does not know them. */
  async matchOrCreate(platform: Platform, input: WebhookCustomer): Promise<{ customerId: string; created: boolean }> {
    const link = await this.prisma.customerPlatform.findUnique({
      where: { platformId_externalId: { platformId: platform.id, externalId: input.externalId } },
      select: { customerId: true },
    });
    const match =
      link?.customerId ??
      (input.email
        ? (
            await this.prisma.customer.findFirst({
              where: { OR: [{ email: { equals: input.email, mode: "insensitive" } }, { contacts: { some: { email: { equals: input.email, mode: "insensitive" } } } }] },
              orderBy: { updatedAt: "desc" },
              select: { id: true },
            })
          )?.id
        : undefined) ??
      (await findCustomerByPhone(this.prisma, input.phone))?.id;

    if (match) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.customer.findUniqueOrThrow({ where: { id: match }, select: { ...Object.fromEntries(FILLABLE.map((f) => [f, true])), id: true } as Prisma.CustomerSelect });
        const fill: Record<string, string> = {};
        for (const field of FILLABLE) {
          const value = input[field];
          if (value && !(current as Record<string, unknown>)[field]) fill[field] = value;
        }
        if (Object.keys(fill).length > 0) {
          await tx.customer.update({ where: { id: match }, data: fill });
          await this.activity.record({ customerId: match, type: "CUSTOMER_UPDATED", data: { fields: Object.keys(fill), platform: platform.name } }, tx);
        }
        const existing = await tx.customerPlatform.findUnique({ where: { customerId_platformId: { customerId: match, platformId: platform.id } } });
        if (!existing) {
          await tx.customerPlatform.create({ data: { customerId: match, platformId: platform.id, externalId: input.externalId } });
          await this.activity.record({ customerId: match, type: "PLATFORM_LINKED", data: { platform: platform.name } }, tx);
        } else if (!existing.externalId) {
          await tx.customerPlatform.update({ where: { customerId_platformId: { customerId: match, platformId: platform.id } }, data: { externalId: input.externalId } });
        }
      });
      return { customerId: match, created: false };
    }

    if (!(input.name || input.firstName || input.lastName || input.companyName || input.email)) {
      throw new Error(`Unknown customer "${input.externalId}": send a name, company name or email the first time so the CRM can create them.`);
    }
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ");
    const displayName = (input.type === "COMPANY" ? input.companyName || input.name || fullName : input.name || fullName || input.companyName) || input.email || input.externalId;
    const customer = await this.prisma.$transaction(async (tx) => {
      const row = await tx.customer.create({
        data: {
          type: input.type,
          displayName: displayName.slice(0, 160),
          firstName: input.firstName,
          lastName: input.lastName,
          companyName: input.companyName,
          email: input.email,
          phone: input.phone,
          city: input.city,
          country: input.country,
          platforms: { create: { platformId: platform.id, externalId: input.externalId } },
        },
        select: { id: true },
      });
      await this.activity.record({ customerId: row.id, type: "CUSTOMER_CREATED", data: { platform: platform.name } }, tx);
      return row;
    });
    return { customerId: customer.id, created: true };
  }
}
