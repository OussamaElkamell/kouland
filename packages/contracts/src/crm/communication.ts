import { z } from "zod";
import { ERROR_CODES, idSchema, optionalPhone, optionalText, pageQuery, phoneSchema, refSchema, text } from "./common";

// ---- Email: each person's own Google Workspace or Microsoft 365 mailbox ----

export const EMAIL_PROVIDERS = ["GOOGLE", "MICROSOFT"] as const;
export const emailProviderSchema = z.enum(EMAIL_PROVIDERS);
export type EmailProvider = z.infer<typeof emailProviderSchema>;

/** GET /email/connection */
export const emailConnectionSchema = z.object({
  provider: emailProviderSchema.nullable(),
  /** The connected mailbox's address; null when none is connected. */
  email: z.string().nullable(),
  /** Providers set up on the server (their OAuth app ids are configured). */
  available: z.array(emailProviderSchema),
});
export type EmailConnection = z.infer<typeof emailConnectionSchema>;

export const emailAddressSchema = z.object({ name: z.string().nullable(), email: z.string() });
export type EmailAddress = z.infer<typeof emailAddressSchema>;

export const emailSummarySchema = z.object({
  id: z.string(),
  threadId: z.string().nullable(),
  subject: z.string(),
  from: emailAddressSchema,
  to: z.array(emailAddressSchema),
  date: z.string(),
  snippet: z.string(),
  /** Sent from the connected mailbox (otherwise received). */
  outgoing: z.boolean(),
});
export type EmailSummary = z.infer<typeof emailSummarySchema>;

/** GET /customers/:id/emails: emails between the person's mailbox and the customer's addresses. */
export const customerEmailsSchema = z.object({
  /** False when the person has not connected a mailbox. */
  connected: z.boolean(),
  /** The customer's addresses that were searched. */
  addresses: z.array(z.string()),
  items: z.array(emailSummarySchema),
});
export type CustomerEmails = z.infer<typeof customerEmailsSchema>;

/** GET /email/messages/:id */
export const emailMessageSchema = emailSummarySchema.extend({
  cc: z.array(emailAddressSchema),
  /** HTML body: shown in a sandboxed frame (no scripts). */
  html: z.string().nullable(),
  text: z.string().nullable(),
  /** Link to open it in Gmail or Outlook. */
  webLink: z.string().nullable(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;

const emailAddress = z.string().trim().toLowerCase().min(1, ERROR_CODES.required).max(254, ERROR_CODES.tooLong).email(ERROR_CODES.email);

/** POST /customers/:id/emails: a new email, or a reply when `replyToId` is set. */
export const sendEmailSchema = z.object({
  to: emailAddress,
  cc: z
    .string()
    .trim()
    .max(1000, ERROR_CODES.tooLong)
    .optional()
    .transform((value) => (value ? value.split(/[,;\s]+/).filter(Boolean) : []))
    .refine((list) => list.every((item) => z.string().email().safeParse(item).success), ERROR_CODES.email),
  subject: text(300),
  body: text(20000),
  replyToId: z.string().trim().max(300).optional(),
});
export type SendEmailInput = z.input<typeof sendEmailSchema>;

// ---- Phone (Twilio): calls and SMS on the company number ----

/** GET /settings/phone (administrators). */
export const phoneSettingsSchema = z.object({
  /** Twilio's account and number are set on the server. */
  configured: z.boolean(),
  companyNumber: z.string().nullable(),
  /** Rings when the caller is unknown, or when the customer's employee does not answer. */
  fallbackNumber: z.string().nullable(),
  /** Seconds each phone rings before the next is tried. */
  ringSeconds: z.number().int(),
  /** Addresses to paste in the Twilio console for the company number. */
  voiceUrl: z.string(),
  smsUrl: z.string(),
  /** "Call status changes" address: tells the CRM when a caller hangs up before anyone answers. */
  statusUrl: z.string(),
});
export type PhoneSettings = z.infer<typeof phoneSettingsSchema>;

/** PUT /settings/phone */
export const updatePhoneSettingsSchema = z.object({
  fallbackNumber: optionalPhone,
  ringSeconds: z.coerce.number().int().min(10, ERROR_CODES.invalid).max(60, ERROR_CODES.invalid).default(20),
});
export type UpdatePhoneSettingsInput = z.input<typeof updatePhoneSettingsSchema>;

export const CALL_STATUSES = ["RINGING", "COMPLETED", "MISSED", "FAILED"] as const;
export const callStatusSchema = z.enum(CALL_STATUSES);
export type CallStatus = z.infer<typeof callStatusSchema>;
export const directionSchema = z.enum(["INBOUND", "OUTBOUND"]);
export type Direction = z.infer<typeof directionSchema>;

export const callSchema = z.object({
  id: z.string(),
  direction: directionSchema,
  status: callStatusSchema,
  fromNumber: z.string(),
  toNumber: z.string(),
  durationSec: z.number().int().nullable(),
  customer: refSchema.nullable(),
  user: refSchema.nullable(),
  notes: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type Call = z.infer<typeof callSchema>;

export const CALL_FILTERS = ["all", "mine", "missed", "unknown"] as const;
export const callListQuerySchema = z.object({
  ...pageQuery,
  filter: z.enum(CALL_FILTERS).default("all"),
  customerId: idSchema.optional(),
});
export type CallListQuery = z.input<typeof callListQuerySchema>;

/** POST /calls: rings the employee's own phone, then connects the customer. */
export const startCallSchema = z.object({ customerId: idSchema, to: phoneSchema });
export type StartCallInput = z.input<typeof startCallSchema>;

/** PATCH /calls/:id: notes, or the customer an unknown caller turned out to be. */
export const updateCallSchema = z.object({
  notes: optionalText(5000).optional(),
  customerId: idSchema.nullable().optional(),
});
export type UpdateCallInput = z.input<typeof updateCallSchema>;

export const smsSchema = z.object({
  id: z.string(),
  direction: directionSchema,
  fromNumber: z.string(),
  toNumber: z.string(),
  body: z.string(),
  status: z.string(),
  customer: refSchema.nullable(),
  user: refSchema.nullable(),
  createdAt: z.string(),
});
export type Sms = z.infer<typeof smsSchema>;

export const smsListQuerySchema = z.object({ ...pageQuery, customerId: idSchema.optional() });
export type SmsListQuery = z.input<typeof smsListQuerySchema>;

/** POST /sms */
export const sendSmsSchema = z.object({ customerId: idSchema, to: phoneSchema, body: text(1600) });
export type SendSmsInput = z.input<typeof sendSmsSchema>;
