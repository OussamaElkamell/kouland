import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  levelAllows,
  type Call,
  type callListQuerySchema,
  type PhoneSettings,
  type sendSmsSchema,
  type Sms,
  type smsListQuerySchema,
  type startCallSchema,
  type updateCallSchema,
  type updatePhoneSettingsSchema,
} from "@kouland/contracts";
import type { z } from "zod";
import { type AuthUser } from "../auth/auth-user";
import { customerScopeWhere, CustomerAccess } from "../customers/customer-access";
import { findCustomerByPhone } from "../common/phone-match";
import { notFound } from "../common/prisma-errors";
import { publicApiUrl } from "../common/urls";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { createCall, requireTwilio, sendMessage, twilioConfig, twimlDial, twimlSay, TWIML_EMPTY, TWIML_HANGUP } from "./twilio";

const FALLBACK_KEY = "phone.fallbackNumber";
const RING_KEY = "phone.ringSeconds";
const NOBODY = "Thank you for calling Kouland Technology. No one can take your call right now. Please try again later.";

const CALL_SELECT = {
  id: true,
  direction: true,
  status: true,
  fromNumber: true,
  toNumber: true,
  durationSec: true,
  notes: true,
  startedAt: true,
  endedAt: true,
  customer: { select: { id: true, displayName: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.CallSelect;

const toCall = ({ customer, startedAt, endedAt, ...row }: Prisma.CallGetPayload<{ select: typeof CALL_SELECT }>): Call => ({
  ...row,
  customer: customer ? { id: customer.id, name: customer.displayName } : null,
  startedAt: startedAt.toISOString(),
  endedAt: endedAt?.toISOString() ?? null,
});

const SMS_SELECT = {
  id: true,
  direction: true,
  fromNumber: true,
  toNumber: true,
  body: true,
  status: true,
  createdAt: true,
  customer: { select: { id: true, displayName: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.SmsMessageSelect;

const toSms = ({ customer, createdAt, ...row }: Prisma.SmsMessageGetPayload<{ select: typeof SMS_SELECT }>): Sms => ({
  ...row,
  customer: customer ? { id: customer.id, name: customer.displayName } : null,
  createdAt: createdAt.toISOString(),
});

/** Twilio sends form fields; these are the ones used. */
export type TwilioParams = Record<string, string>;

/**
 * The company's Twilio number in the CRM.
 *
 * Incoming calls ring the phone of the employee who looks after the caller (the owner of their latest open
 * opportunity, else whoever last spoke with them), then the default number set by the administrator. Click-to-call
 * rings the employee's own phone first, then connects the customer with the company number shown. Every call and
 * SMS with a known customer goes into their history; employees add notes to calls. No recording, voicemail or
 * browser calling (outside the first version).
 */
@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CustomerAccess,
    private readonly notifications: NotificationsService,
  ) {}

  private url(path: string): string {
    return `${publicApiUrl()}/api/twilio/${path}`;
  }

  // ---- Settings ----

  private async settings(): Promise<{ fallbackNumber: string | null; ringSeconds: number }> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: [FALLBACK_KEY, RING_KEY] } } });
    const get = (key: string) => rows.find((row) => row.key === key)?.value;
    return { fallbackNumber: get(FALLBACK_KEY) || null, ringSeconds: Number(get(RING_KEY)) || 20 };
  }

  async getSettings(): Promise<PhoneSettings> {
    const config = twilioConfig();
    return {
      configured: Boolean(config),
      companyNumber: config?.phoneNumber ?? null,
      ...(await this.settings()),
      voiceUrl: this.url("voice"),
      smsUrl: this.url("sms"),
      statusUrl: this.url("status"),
    };
  }

  async updateSettings(input: z.output<typeof updatePhoneSettingsSchema>): Promise<PhoneSettings> {
    await this.prisma.$transaction([
      this.prisma.setting.upsert({ where: { key: FALLBACK_KEY }, create: { key: FALLBACK_KEY, value: input.fallbackNumber ?? "" }, update: { value: input.fallbackNumber ?? "" } }),
      this.prisma.setting.upsert({ where: { key: RING_KEY }, create: { key: RING_KEY, value: String(input.ringSeconds) }, update: { value: String(input.ringSeconds) } }),
    ]);
    return this.getSettings();
  }

  // ---- Who looks after a customer ----

  /** The employee who looks after this customer and can take a call: an active account with a phone. */
  private async ownerOf(customerId: string): Promise<{ id: string; phone: string } | null> {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { customerId, status: { notIn: ["WON", "LOST"] }, owner: { isActive: true, phone: { not: null } } },
      orderBy: { updatedAt: "desc" },
      select: { owner: { select: { id: true, phone: true } } },
    });
    if (opportunity?.owner?.phone) return { id: opportunity.owner.id, phone: opportunity.owner.phone };
    const call = await this.prisma.call.findFirst({
      where: { customerId, status: "COMPLETED", user: { isActive: true, phone: { not: null } } },
      orderBy: { startedAt: "desc" },
      select: { user: { select: { id: true, phone: true } } },
    });
    return call?.user?.phone ? { id: call.user.id, phone: call.user.phone } : null;
  }

  /** People told about a missed call or a new SMS: the customer's employee, else those who can edit customers. */
  private async recipients(ownerId: string | null): Promise<string[]> {
    return ownerId ? [ownerId] : this.notifications.peopleWithAccess("CUSTOMERS", "EDIT", null);
  }

  // ---- Incoming calls (Twilio webhooks) ----

  /** The phones to ring for an incoming call, in order. */
  private async targets(ownerId: string | null): Promise<Array<{ phone: string; userId: string | null }>> {
    const { fallbackNumber } = await this.settings();
    const list: Array<{ phone: string; userId: string | null }> = [];
    if (ownerId) {
      const owner = await this.prisma.user.findFirst({ where: { id: ownerId, isActive: true }, select: { phone: true } });
      if (owner?.phone) list.push({ phone: owner.phone, userId: ownerId });
    }
    if (fallbackNumber && !list.some((t) => t.phone === fallbackNumber)) list.push({ phone: fallbackNumber, userId: null });
    return list;
  }

  /** A call to the company number starts. */
  async incomingCall(params: TwilioParams): Promise<string> {
    const sid = params.CallSid ?? "";
    const from = params.From ?? "";
    let call = await this.prisma.call.findUnique({ where: { twilioSid: sid }, select: { id: true, userId: true } });
    if (!call) {
      const customer = await findCustomerByPhone(this.prisma, from);
      const owner = customer ? await this.ownerOf(customer.id) : null;
      call = await this.prisma.call.create({
        data: { twilioSid: sid, direction: "INBOUND", fromNumber: from, toNumber: params.To ?? "", customerId: customer?.id ?? null, userId: owner?.id ?? null },
        select: { id: true, userId: true },
      });
      if (customer) await this.prisma.activity.create({ data: { customerId: customer.id, type: "CALL", callId: call.id, userId: owner?.id ?? null } });
    }
    return this.ring(call.id, call.userId, 0, from);
  }

  private async ring(callId: string, ownerId: string | null, step: number, callerId: string): Promise<string> {
    const targets = await this.targets(ownerId);
    const target = targets[step];
    if (!target) {
      await this.missed(callId);
      return twimlSay(NOBODY);
    }
    const { ringSeconds } = await this.settings();
    return twimlDial({ number: target.phone, timeout: ringSeconds, callerId, action: this.url(`voice/dial?call=${encodeURIComponent(callId)}&step=${step}`) });
  }

  /** The phone that was rung answered (or not): end the call or ring the next one. */
  async incomingDialResult(callId: string, step: number, params: TwilioParams): Promise<string> {
    const call = await this.prisma.call.findUnique({ where: { id: callId }, select: { id: true, userId: true, fromNumber: true } });
    if (!call) return TWIML_HANGUP;
    if (params.DialCallStatus === "completed") {
      const targets = await this.targets(call.userId);
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: "COMPLETED",
          durationSec: Number(params.DialCallDuration) || 0,
          endedAt: new Date(),
          // The default number may belong to no account: then the call stays without an employee.
          userId: targets[step]?.userId ?? null,
        },
      });
      await this.prisma.activity.updateMany({ where: { callId }, data: { userId: targets[step]?.userId ?? null } });
      return TWIML_HANGUP;
    }
    // The caller hung up while it rang.
    if (params.DialCallStatus === "canceled") {
      await this.missed(callId);
      return TWIML_HANGUP;
    }
    return this.ring(callId, call.userId, step + 1, call.fromNumber);
  }

  private async missed(callId: string): Promise<void> {
    const call = await this.prisma.call.update({
      where: { id: callId },
      data: { status: "MISSED", endedAt: new Date() },
      select: { id: true, userId: true, fromNumber: true, customer: { select: { id: true, displayName: true } } },
    });
    await this.notifications.notify({
      userIds: await this.recipients(call.userId),
      type: "MISSED_CALL",
      data: { from: call.fromNumber, name: call.customer?.displayName ?? null },
      link: call.customer ? `/admin/customers/${call.customer.id}` : "/admin/phone?filter=missed",
    });
  }

  /** The caller hung up before anyone answered (Twilio's status callback for the call). */
  async callStatus(params: TwilioParams): Promise<void> {
    const call = await this.prisma.call.findUnique({ where: { twilioSid: params.CallSid ?? "" }, select: { id: true, status: true, direction: true } });
    if (!call || call.status !== "RINGING") return;
    if (call.direction === "INBOUND") return this.missed(call.id);
    // Outbound: the employee's own phone was not answered, so the customer was never called.
    await this.prisma.call.update({ where: { id: call.id }, data: { status: "FAILED", endedAt: new Date() } });
  }

  // ---- Click-to-call ----

  async startCall(user: AuthUser, input: z.output<typeof startCallSchema>): Promise<Call> {
    const config = requireTwilio();
    await this.access.visibleCustomer(user, input.customerId);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true } });
    if (!me.phone) throw new BadRequestException({ statusCode: 400, message: "Add your phone number on your account page first: the CRM rings it, then connects the customer.", fieldErrors: { phone: ["myPhoneMissing"] } });

    const id = randomUUID();
    const { ringSeconds } = await this.settings();
    const twilio = await createCall(config, {
      to: me.phone,
      timeout: ringSeconds + 10,
      url: this.url(`outbound?call=${id}&to=${encodeURIComponent(input.to)}`),
      statusCallback: this.url("status"),
    });
    const row = await this.prisma.call.create({
      data: { id, twilioSid: twilio.sid, direction: "OUTBOUND", fromNumber: config.phoneNumber, toNumber: input.to, customerId: input.customerId, userId: user.id },
      select: CALL_SELECT,
    });
    await this.prisma.activity.create({ data: { customerId: input.customerId, type: "CALL", callId: id, userId: user.id } });
    return toCall(row);
  }

  /** The employee answered their phone: connect the customer. */
  outboundAnswered(callId: string, to: string): string {
    const config = requireTwilio();
    return twimlDial({ number: to, timeout: 30, callerId: config.phoneNumber, action: this.url(`outbound/dial?call=${encodeURIComponent(callId)}`) });
  }

  async outboundDialResult(callId: string, params: TwilioParams): Promise<string> {
    const answered = params.DialCallStatus === "completed";
    await this.prisma.call.updateMany({
      where: { id: callId },
      data: { status: answered ? "COMPLETED" : params.DialCallStatus === "failed" ? "FAILED" : "MISSED", durationSec: answered ? Number(params.DialCallDuration) || 0 : null, endedAt: new Date() },
    });
    return TWIML_HANGUP;
  }

  // ---- Call log ----

  private visibleCalls(user: AuthUser): Prisma.CallWhereInput {
    const scope = customerScopeWhere(user);
    // Calls from unknown numbers are shown to everyone with customer access, so someone can say who it was.
    return Object.keys(scope).length ? { OR: [{ customerId: null }, { customer: scope }] } : {};
  }

  async listCalls(user: AuthUser, query: z.output<typeof callListQuerySchema>) {
    const where: Prisma.CallWhereInput = {
      AND: [
        this.visibleCalls(user),
        query.customerId ? { customerId: query.customerId } : {},
        query.filter === "mine" ? { userId: user.id } : query.filter === "missed" ? { status: "MISSED" } : query.filter === "unknown" ? { customerId: null } : {},
        query.q ? { OR: [{ fromNumber: { contains: query.q } }, { toNumber: { contains: query.q } }, { notes: { contains: query.q, mode: "insensitive" } }] } : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.call.findMany({ where, orderBy: { startedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: CALL_SELECT }),
      this.prisma.call.count({ where }),
    ]);
    return { items: rows.map(toCall), total, page: query.page, pageSize: query.pageSize };
  }

  async updateCall(user: AuthUser, id: string, input: z.output<typeof updateCallSchema>): Promise<Call> {
    const call = await this.prisma.call.findFirst({ where: { id, ...this.visibleCalls(user) }, select: { id: true, userId: true, customerId: true } });
    if (!call) throw notFound("Call");
    const canEdit = levelAllows(user.access.CUSTOMERS, "EDIT");
    if (input.notes !== undefined && call.userId !== user.id && !canEdit) throw new ForbiddenException("Only the person on the call can write its notes.");
    if (input.customerId !== undefined) {
      if (!canEdit) throw new ForbiddenException("You do not have access to this.");
      if (input.customerId) await this.access.visibleCustomer(user, input.customerId);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.call.update({ where: { id }, data: { notes: input.notes, customerId: input.customerId } });
      if (input.customerId !== undefined && input.customerId !== call.customerId) {
        await tx.activity.deleteMany({ where: { callId: id } });
        if (input.customerId) await tx.activity.create({ data: { customerId: input.customerId, type: "CALL", callId: id, userId: call.userId } });
      }
    });
    return toCall(await this.prisma.call.findUniqueOrThrow({ where: { id }, select: CALL_SELECT }));
  }

  // ---- SMS ----

  async sendSms(user: AuthUser, input: z.output<typeof sendSmsSchema>): Promise<Sms> {
    const config = requireTwilio();
    await this.access.visibleCustomer(user, input.customerId);
    const twilio = await sendMessage(config, { to: input.to, body: input.body, statusCallback: this.url("sms/status") });
    const row = await this.prisma.$transaction(async (tx) => {
      const sms = await tx.smsMessage.create({
        data: { twilioSid: twilio.sid, direction: "OUTBOUND", fromNumber: config.phoneNumber, toNumber: input.to, body: input.body, status: twilio.status, customerId: input.customerId, userId: user.id },
        select: SMS_SELECT,
      });
      await tx.activity.create({ data: { customerId: input.customerId, type: "SMS_SENT", body: input.body, userId: user.id, data: { to: input.to } } });
      return sms;
    });
    return toSms(row);
  }

  async incomingSms(params: TwilioParams): Promise<string> {
    const sid = params.MessageSid ?? params.SmsSid ?? "";
    if (!sid || (await this.prisma.smsMessage.findUnique({ where: { twilioSid: sid }, select: { id: true } }))) return TWIML_EMPTY;
    const from = params.From ?? "";
    const body = (params.Body ?? "").slice(0, 1600);
    const customer = await findCustomerByPhone(this.prisma, from);
    await this.prisma.$transaction(async (tx) => {
      await tx.smsMessage.create({ data: { twilioSid: sid, direction: "INBOUND", fromNumber: from, toNumber: params.To ?? "", body, status: "received", customerId: customer?.id ?? null } });
      if (customer) await tx.activity.create({ data: { customerId: customer.id, type: "SMS_RECEIVED", body, data: { from } } });
    });
    const owner = customer ? await this.ownerOf(customer.id) : null;
    await this.notifications.notify({
      userIds: await this.recipients(owner?.id ?? null),
      type: "NEW_SMS",
      data: { from, name: customer?.displayName ?? null, preview: body.slice(0, 80) },
      link: customer ? `/admin/customers/${customer.id}` : "/admin/phone?tab=sms",
    });
    // No automatic answer.
    return TWIML_EMPTY;
  }

  async smsStatus(params: TwilioParams): Promise<void> {
    const sid = params.MessageSid ?? params.SmsSid;
    if (sid && params.MessageStatus) await this.prisma.smsMessage.updateMany({ where: { twilioSid: sid }, data: { status: params.MessageStatus } });
  }

  async listSms(user: AuthUser, query: z.output<typeof smsListQuerySchema>) {
    const scope = customerScopeWhere(user);
    const where: Prisma.SmsMessageWhereInput = {
      AND: [
        Object.keys(scope).length ? { OR: [{ customerId: null }, { customer: scope }] } : {},
        query.customerId ? { customerId: query.customerId } : {},
        query.q ? { OR: [{ fromNumber: { contains: query.q } }, { toNumber: { contains: query.q } }, { body: { contains: query.q, mode: "insensitive" } }] } : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.smsMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: SMS_SELECT }),
      this.prisma.smsMessage.count({ where }),
    ]);
    return { items: rows.map(toSms), total, page: query.page, pageSize: query.pageSize };
  }
}
