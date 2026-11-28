import { Body, Controller, Get, Headers, HttpCode, Module, Param, Patch, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { updateIntegrationSchema, WEBHOOK_SIGNATURE_HEADER, type PlatformIntegration, type WebhookReceipt } from "@kouland/contracts";
import type { z } from "zod";
import { AdminOnly, Crm } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CustomersModule } from "../customers/customers.module";
import { IntegrationService } from "./integration.service";
import { PlatformSyncService } from "./platform-sync.service";

/** Public: where platforms send their events. Authenticated by the signature, not by a CRM session. */
@Controller("webhooks/platforms")
export class PlatformWebhookController {
  constructor(private readonly sync: PlatformSyncService) {}

  @Post(":platformId")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 1200 } })
  receive(
    @Param("platformId") platformId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers(WEBHOOK_SIGNATURE_HEADER.toLowerCase()) signature?: string,
  ): Promise<WebhookReceipt> {
    return this.sync.receive(platformId, req.rawBody, signature);
  }
}

/** Administrators: a platform's webhook settings and the events it sent. */
@Controller("platforms/:id/integration")
@Crm()
@AdminOnly()
export class IntegrationController {
  constructor(private readonly integrations: IntegrationService) {}

  @Get()
  get(@Param("id") id: string): Promise<PlatformIntegration> {
    return this.integrations.get(id);
  }

  @Patch()
  update(@Param("id") id: string, @Body(new ZodValidationPipe(updateIntegrationSchema)) body: z.output<typeof updateIntegrationSchema>): Promise<PlatformIntegration> {
    return this.integrations.setEnabled(id, body.enabled);
  }

  @Post("secret")
  rotate(@Param("id") id: string): Promise<PlatformIntegration> {
    return this.integrations.rotateSecret(id);
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [PlatformWebhookController, IntegrationController],
  providers: [PlatformSyncService, IntegrationService],
})
export class SyncModule {}
