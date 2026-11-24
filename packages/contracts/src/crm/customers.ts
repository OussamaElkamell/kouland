import { z } from "zod";
import {
  ERROR_CODES,
  idSchema,
  optionalEmail,
  optionalText,
  optionalUrl,
  pageQuery,
  platformRefSchema,
  refSchema,
  text,
} from "./common";

export const CUSTOMER_TYPES = ["INDIVIDUAL", "COMPANY"] as const;
export const customerTypeSchema = z.enum(CUSTOMER_TYPES);
export type CustomerType = z.infer<typeof customerTypeSchema>;

/** A prospect becomes a customer when an opportunity is won, or when staff mark them so. */
export const CUSTOMER_STAGES = ["PROSPECT", "CUSTOMER"] as const;
export const customerStageSchema = z.enum(CUSTOMER_STAGES);
export type CustomerStage = z.infer<typeof customerStageSchema>;

/** The customer's own fields, without platforms. Also used to register a prospect together with an opportunity. */
export const customerFieldsSchema = z
  .object({
    type: customerTypeSchema,
    stage: customerStageSchema.default("PROSPECT"),
    firstName: optionalText(80),
    lastName: optionalText(80),
    companyName: optionalText(160),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalUrl,
    addressLine: optionalText(200),
    city: optionalText(100),
    region: optionalText(100),
    postalCode: optionalText(20),
    country: optionalText(100),
    notes: optionalText(5000),
  })
  .superRefine((value, ctx) => {
    if (value.type === "INDIVIDUAL" && !value.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: ERROR_CODES.required });
    if (value.type === "COMPANY" && !value.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: ERROR_CODES.required });
  });
export type CustomerFieldsInput = z.input<typeof customerFieldsSchema>;
export type CustomerFields = z.output<typeof customerFieldsSchema>;

/** Name shown in lists: the company name, or the person's full name. */
export function customerDisplayName(value: Pick<CustomerFields, "type" | "firstName" | "lastName" | "companyName">): string {
  if (value.type === "COMPANY") return value.companyName ?? "";
  return [value.firstName, value.lastName].filter(Boolean).join(" ");
}

/** POST /customers and PUT /customers/:id (the whole record is sent). */
export const customerInputSchema = z.object({
  customer: customerFieldsSchema,
  /** The platforms (services) the customer uses or is interested in. */
  platformIds: z.array(idSchema).max(50).default([]),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

/** PATCH /customers/:id/stage */
export const customerStageInputSchema = z.object({ stage: customerStageSchema });

/** GET /customers */
export const customerListQuerySchema = z.object({
  ...pageQuery,
  type: customerTypeSchema.optional(),
  stage: customerStageSchema.optional(),
  platformId: idSchema.optional(),
});
export type CustomerListQuery = z.input<typeof customerListQuerySchema>;

export const customerSummarySchema = z.object({
  id: z.string(),
  type: customerTypeSchema,
  stage: customerStageSchema,
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  platforms: z.array(platformRefSchema),
  openOpportunities: z.number().int(),
  updatedAt: z.string(),
});
export type CustomerSummary = z.infer<typeof customerSummarySchema>;

// ---- Contacts (people at a company) ----

/** POST /customers/:id/contacts and PUT /customers/:id/contacts/:contactId */
export const contactInputSchema = z.object({
  firstName: text(80),
  lastName: optionalText(80),
  jobTitle: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  isPrimary: z.boolean().default(false),
});
export type ContactInput = z.input<typeof contactInputSchema>;

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type Contact = z.infer<typeof contactSchema>;

// ---- History ----

export const ACTIVITY_TYPES = [
  "NOTE",
  "CUSTOMER_CREATED",
  "CUSTOMER_UPDATED",
  "STAGE_CHANGED",
  "CONTACT_ADDED",
  "PLATFORM_LINKED",
  "PLATFORM_UNLINKED",
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_STATUS",
  "PROPOSAL_CREATED",
  "PROPOSAL_STATUS",
  "TICKET_CREATED",
  "TICKET_STATUS",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "APPOINTMENT_SCHEDULED",
  "PLATFORM_EVENT",
  "EMAIL_SENT",
  "CALL",
  "SMS_SENT",
  "SMS_RECEIVED",
] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof activityTypeSchema>;

/** POST /customers/:id/notes */
export const noteInputSchema = z.object({ body: text(5000), opportunityId: idSchema.optional() });
export type NoteInput = z.input<typeof noteInputSchema>;

export const activitySchema = z.object({
  id: z.string(),
  type: activityTypeSchema,
  body: z.string().nullable(),
  /** Details for the screen to word the event: names, old and new status… */
  data: z.record(z.string(), z.unknown()).nullable(),
  user: refSchema.nullable(),
  opportunity: z.object({ id: z.string(), title: z.string() }).nullable(),
  ticket: z.object({ id: z.string(), number: z.number().int(), subject: z.string() }).nullable(),
  /** For CALL events: the call, with the notes written about it. */
  call: z
    .object({ id: z.string(), direction: z.enum(["INBOUND", "OUTBOUND"]), status: z.string(), durationSec: z.number().int().nullable(), notes: z.string().nullable() })
    .nullable(),
  createdAt: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

export const customerDetailSchema = z.object({
  id: z.string(),
  type: customerTypeSchema,
  stage: customerStageSchema,
  displayName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  companyName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  notes: z.string().nullable(),
  createdBy: refSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  platforms: z.array(platformRefSchema),
  contacts: z.array(contactSchema),
  activities: z.array(activitySchema),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
