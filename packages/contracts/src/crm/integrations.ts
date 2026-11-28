import { z } from "zod";
import { optionalText, refSchema } from "./common";

// ---- Platform webhooks: what a platform sends to the CRM ----

/**
 * The customer as a platform knows them. `externalId` (the platform's own id) is required: it is how the CRM
 * recognises the same customer next time. On the first event the CRM also tries the email, then the phone, so a
 * customer staff already entered is linked instead of duplicated. Later events may send the externalId alone; the
 * first time a customer is seen, a name, company name or email is needed to create them.
 */
export const webhookCustomerSchema = z
  .object({
    externalId: z.coerce.string().trim().min(1).max(120),
    type: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
    firstName: optionalText(80),
    lastName: optionalText(80),
    companyName: optionalText(160),
    /** Full name, when the platform has no first and last name. */
    name: optionalText(160),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .email()
      .nullish()
      .or(z.literal("").transform(() => null))
      .transform((value) => value ?? null),
    phone: optionalText(40),
    city: optionalText(120),
    country: optionalText(120),
  });
export type WebhookCustomer = z.output<typeof webhookCustomerSchema>;

const eventBase = {
  /** The platform's unique id for this event. The same id sent again (a retry) is applied only once. */
  id: z.coerce.string().trim().min(1).max(120),
};

/** The body of a webhook call. */
export const webhookPayloadSchema = z.discriminatedUnion("type", [
  /** Checks the connection: recorded in the log, changes nothing. */
  z.object({ ...eventBase, type: z.literal("ping") }),
  /** Creates the customer, or fills in what the CRM does not have yet. */
  z.object({ ...eventBase, type: z.literal("customer.upsert"), customer: webhookCustomerSchema }),
  /** Something that happened to the customer on the platform (a booking, an order, a payment…), added to their history. */
  z.object({
    ...eventBase,
    type: z.literal("event"),
    customer: webhookCustomerSchema,
    event: z.object({
      /** Short machine name, e.g. "booking.created". */
      name: z.string().trim().min(1).max(80),
      /** What staff read in the history, e.g. "Booking #812 confirmed". */
      title: z.string().trim().min(1).max(200),
      details: optionalText(2000),
      /** Where to see it on the platform. */
      url: z.string().trim().url().max(500).nullish(),
      /** When it happened (ISO 8601); defaults to when it was received. */
      occurredAt: z.string().datetime({ offset: true }).nullish(),
    }),
  }),
]);
export type WebhookPayload = z.output<typeof webhookPayloadSchema>;

/** Header carrying the signature: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export const WEBHOOK_SIGNATURE_HEADER = "X-Kouland-Signature";

/** What the webhook answers. `duplicate`: this event id was already received. */
export const webhookReceiptSchema = z.object({
  received: z.literal(true),
  status: z.enum(["PROCESSED", "FAILED", "DUPLICATE"]),
  customerId: z.string().nullable(),
});
export type WebhookReceipt = z.infer<typeof webhookReceiptSchema>;

// ---- Platform integration settings (administrators) ----

export const platformEventSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  type: z.string(),
  status: z.enum(["PROCESSED", "FAILED"]),
  error: z.string().nullable(),
  customer: refSchema.nullable(),
  /** The event created the customer (instead of matching an existing one). */
  created: z.boolean(),
  receivedAt: z.string(),
});
export type PlatformEvent = z.infer<typeof platformEventSchema>;

export const platformIntegrationSchema = z.object({
  platformId: z.string(),
  enabled: z.boolean(),
  /** The address the platform sends its events to. */
  webhookUrl: z.string(),
  /** Signing secret, shared with the platform. Null until the webhook is first enabled. */
  secret: z.string().nullable(),
  lastWebhookAt: z.string().nullable(),
  /** Latest events received, newest first. */
  events: z.array(platformEventSchema),
});
export type PlatformIntegration = z.infer<typeof platformIntegrationSchema>;

/** PATCH /platforms/:id/integration */
export const updateIntegrationSchema = z.object({ enabled: z.boolean() });
export type UpdateIntegrationInput = z.input<typeof updateIntegrationSchema>;
