import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Logger, Module, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  callListQuerySchema,
  sendSmsSchema,
  smsListQuerySchema,
  startCallSchema,
  updateCallSchema,
  updatePhoneSettingsSchema,
  type Call,
  type Page,
  type PhoneSettings,
  type Sms,
} from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { AdminOnly, Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { publicApiUrl } from "../common/urls";
import { CustomersModule } from "../customers/customers.module";
import { PhoneService, type TwilioParams } from "./phone.service";
import { twilioConfig, validTwilioRequest } from "./twilio";

/**
 * Public: Twilio's webhooks for the company number. Each request must carry a valid X-Twilio-Signature (made with
 * the account's auth token over the exact address Twilio called), so nobody else can post fake calls or SMS.
 */
@Controller("twilio")
@SkipThrottle()
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly phone: PhoneService) {}

  private verified(req: Request): TwilioParams {
    const config = twilioConfig();
    const params = Object.fromEntries(Object.entries((req.body ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    const url = `${publicApiUrl()}${req.originalUrl}`;
    if (!config || !validTwilioRequest(config.authToken, url, params, req.header("x-twilio-signature"))) {
      this.logger.warn(`Refused a Twilio request with a bad signature for ${url}. Check PUBLIC_API_URL and TWILIO_AUTH_TOKEN.`);
      throw new ForbiddenException("Invalid Twilio signature.");
    }
    return params;
  }

  @Post("voice")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  voice(@Req() req: Request): Promise<string> {
    return this.phone.incomingCall(this.verified(req));
  }

  @Post("voice/dial")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  voiceDial(@Req() req: Request, @Query("call") call: string, @Query("step") step: string): Promise<string> {
    return this.phone.incomingDialResult(call, Number(step) || 0, this.verified(req));
  }

  @Post("outbound")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  outbound(@Req() req: Request, @Query("call") call: string, @Query("to") to: string): string {
    this.verified(req);
    return this.phone.outboundAnswered(call, to);
  }

  @Post("outbound/dial")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  outboundDial(@Req() req: Request, @Query("call") call: string): Promise<string> {
    return this.phone.outboundDialResult(call, this.verified(req));
  }

  @Post("status")
  @HttpCode(204)
  status(@Req() req: Request): Promise<void> {
    return this.phone.callStatus(this.verified(req));
  }

  @Post("sms")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  sms(@Req() req: Request): Promise<string> {
    return this.phone.incomingSms(this.verified(req));
  }

  @Post("sms/status")
  @HttpCode(204)
  smsStatus(@Req() req: Request): Promise<void> {
    return this.phone.smsStatus(this.verified(req));
  }
}

@Controller("calls")
@Crm()
export class CallsController {
  constructor(private readonly phone: PhoneService) {}

  @Get()
  @RequireAccess("CUSTOMERS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(callListQuerySchema)) query: z.output<typeof callListQuerySchema>): Promise<Page<Call>> {
    return this.phone.listCalls(user, query);
  }

  /** Click-to-call: rings the employee's phone, then the customer. */
  @Post()
  @RequireAccess("CUSTOMERS", "EDIT")
  start(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(startCallSchema)) body: z.output<typeof startCallSchema>): Promise<Call> {
    return this.phone.startCall(user, body);
  }

  @Patch(":id")
  @RequireAccess("CUSTOMERS", "VIEW")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body(new ZodValidationPipe(updateCallSchema)) body: z.output<typeof updateCallSchema>): Promise<Call> {
    return this.phone.updateCall(user, id, body);
  }
}

@Controller("sms")
@Crm()
export class SmsController {
  constructor(private readonly phone: PhoneService) {}

  @Get()
  @RequireAccess("CUSTOMERS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(smsListQuerySchema)) query: z.output<typeof smsListQuerySchema>): Promise<Page<Sms>> {
    return this.phone.listSms(user, query);
  }

  @Post()
  @RequireAccess("CUSTOMERS", "EDIT")
  send(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(sendSmsSchema)) body: z.output<typeof sendSmsSchema>): Promise<Sms> {
    return this.phone.sendSms(user, body);
  }
}

@Controller("settings/phone")
@Crm()
@AdminOnly()
export class PhoneSettingsController {
  constructor(private readonly phone: PhoneService) {}

  @Get()
  get(): Promise<PhoneSettings> {
    return this.phone.getSettings();
  }

  @Put()
  update(@Body(new ZodValidationPipe(updatePhoneSettingsSchema)) body: z.output<typeof updatePhoneSettingsSchema>): Promise<PhoneSettings> {
    return this.phone.updateSettings(body);
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [TwilioWebhookController, CallsController, SmsController, PhoneSettingsController],
  providers: [PhoneService],
})
export class PhoneModule {}
