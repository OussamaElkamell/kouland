import { Injectable } from "@nestjs/common";
import type { PlatformIntegration } from "@kouland/contracts";
import { notFound } from "../common/prisma-errors";
import { decryptSecret, encryptSecret, randomSecret } from "../common/secrets";
import { publicApiUrl } from "../common/urls";
import { PrismaService } from "../prisma/prisma.service";

/** Administrators' view of a platform's webhook: address, secret, on/off, and the latest events received. */
@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(platformId: string): Promise<PlatformIntegration> {
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
      select: { id: true, webhookEnabled: true, webhookSecretEnc: true, lastWebhookAt: true },
    });
    if (!platform) throw notFound("Platform");
    const events = await this.prisma.platformEvent.findMany({
      where: { platformId },
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: { id: true, eventId: true, type: true, status: true, error: true, created: true, receivedAt: true, customer: { select: { id: true, displayName: true } } },
    });
    return {
      platformId: platform.id,
      enabled: platform.webhookEnabled,
      webhookUrl: `${publicApiUrl()}/api/webhooks/platforms/${platform.id}`,
      secret: platform.webhookSecretEnc ? decryptSecret(platform.webhookSecretEnc) : null,
      lastWebhookAt: platform.lastWebhookAt?.toISOString() ?? null,
      events: events.map(({ customer, receivedAt, ...event }) => ({
        ...event,
        customer: customer ? { id: customer.id, name: customer.displayName } : null,
        receivedAt: receivedAt.toISOString(),
      })),
    };
  }

  /** Turning it on the first time creates the secret. */
  async setEnabled(platformId: string, enabled: boolean): Promise<PlatformIntegration> {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId }, select: { webhookSecretEnc: true } });
    if (!platform) throw notFound("Platform");
    await this.prisma.platform.update({
      where: { id: platformId },
      data: { webhookEnabled: enabled, ...(enabled && !platform.webhookSecretEnc ? { webhookSecretEnc: encryptSecret(randomSecret("whsec")) } : {}) },
    });
    return this.get(platformId);
  }

  /** A new secret: the old one stops working at once, so the platform must be updated with the new one. */
  async rotateSecret(platformId: string): Promise<PlatformIntegration> {
    if (!(await this.prisma.platform.findUnique({ where: { id: platformId }, select: { id: true } }))) throw notFound("Platform");
    await this.prisma.platform.update({ where: { id: platformId }, data: { webhookSecretEnc: encryptSecret(randomSecret("whsec")) } });
    return this.get(platformId);
  }
}
