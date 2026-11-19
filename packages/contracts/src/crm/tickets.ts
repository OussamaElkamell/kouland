import { z } from "zod";
import { ERROR_CODES, idSchema, optionalText, pageQuery, platformRefSchema, refSchema, text } from "./common";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
/** Tickets still needing work. RESOLVED and CLOSED are done. */
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"];

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
/** "High priority" in the requirements. */
export const HIGH_PRIORITIES: readonly TicketPriority[] = ["HIGH", "URGENT"];

export const ticketSourceSchema = z.enum(["STAFF", "WEBSITE"]);
export type TicketSource = z.infer<typeof ticketSourceSchema>;

const nullableId = idSchema.nullish().transform((value) => value ?? null);

// ---- Departments (administrators) ----

export const departmentInputSchema = z.object({
  name: text(80),
  description: optionalText(300),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type DepartmentInput = z.input<typeof departmentInputSchema>;

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  openTickets: z.number().int(),
});
export type Department = z.infer<typeof departmentSchema>;

// ---- Tickets ----

/** POST /tickets (staff). */
export const createTicketSchema = z.object({
  subject: text(160),
  description: text(10000),
  priority: ticketPrioritySchema.default("NORMAL"),
  customerId: nullableId,
  platformId: nullableId,
  departmentId: nullableId,
  assigneeId: nullableId,
});
export type CreateTicketInput = z.input<typeof createTicketSchema>;

/** PATCH /tickets/:id: any of status, priority, department, assignee; each change is recorded. */
export const updateTicketSchema = z.object({
  subject: text(160).optional(),
  description: text(10000).optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  customerId: nullableId.optional(),
  platformId: nullableId.optional(),
  departmentId: nullableId.optional(),
  assigneeId: nullableId.optional(),
});
export type UpdateTicketInput = z.input<typeof updateTicketSchema>;

/** POST /tickets/:id/comments */
export const ticketCommentSchema = z.object({ body: text(10000) });

/** GET /tickets */
export const ticketListQuerySchema = z.object({
  ...pageQuery,
  status: ticketStatusSchema.optional(),
  /** "active" (open, in progress, waiting) or "done" (resolved, closed). */
  state: z.enum(["active", "done"]).optional(),
  priority: ticketPrioritySchema.optional(),
  /** Only high and urgent. */
  urgent: z.enum(["1", "true"]).optional(),
  platformId: idSchema.optional(),
  departmentId: idSchema.optional(),
  /** An account id, "me", or "none" (not assigned yet). */
  assigneeId: idSchema.optional(),
  customerId: idSchema.optional(),
});
export type TicketListQuery = z.input<typeof ticketListQuerySchema>;

export const ticketSummarySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  subject: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  source: ticketSourceSchema,
  customer: refSchema.nullable(),
  requesterName: z.string().nullable(),
  platform: platformRefSchema.nullable(),
  department: refSchema.nullable(),
  assignee: refSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

export const ticketUpdateTypeSchema = z.enum(["COMMENT", "STATUS", "PRIORITY", "ASSIGNED", "DEPARTMENT"]);
export const ticketUpdateSchema = z.object({
  id: z.string(),
  type: ticketUpdateTypeSchema,
  body: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  user: refSchema.nullable(),
  createdAt: z.string(),
});
export type TicketUpdate = z.infer<typeof ticketUpdateSchema>;

export const ticketDetailSchema = ticketSummarySchema.extend({
  description: z.string(),
  requesterEmail: z.string().nullable(),
  requesterPhone: z.string().nullable(),
  createdBy: refSchema.nullable(),
  resolvedAt: z.string().nullable(),
  updates: z.array(ticketUpdateSchema),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

// ---- Website support form (public) ----

/** POST /support/tickets: the "Report an issue" form on kouland.com. */
export const supportRequestSchema = z.object({
  name: z.string().trim().min(2, ERROR_CODES.required).max(120, ERROR_CODES.tooLong),
  email: z.string().trim().toLowerCase().min(1, ERROR_CODES.required).max(254, ERROR_CODES.tooLong).email(ERROR_CODES.email),
  phone: optionalText(40),
  platformId: nullableId,
  subject: z.string().trim().min(3, ERROR_CODES.required).max(160, ERROR_CODES.tooLong),
  description: z.string().trim().min(10, ERROR_CODES.tooShort).max(5000, ERROR_CODES.tooLong),
});
export type SupportRequestInput = z.input<typeof supportRequestSchema>;

export const supportReceiptSchema = z.object({ number: z.number().int() });
export type SupportReceipt = z.infer<typeof supportReceiptSchema>;

/** GET /support/platforms: the services a visitor can choose in the form. */
export const supportPlatformsSchema = z.array(z.object({ id: z.string(), name: z.string() }));

