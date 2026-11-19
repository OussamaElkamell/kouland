import { z } from "zod";
import { ERROR_CODES, idSchema, optionalText, pageQuery, platformRefSchema, refSchema, text } from "./common";

/** An instant from the browser (datetime-local converted to ISO), or null. */
const optionalInstant = z
  .string({ invalid_type_error: ERROR_CODES.invalid })
  .trim()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), ERROR_CODES.date);
const instant = z
  .string({ required_error: ERROR_CODES.required })
  .trim()
  .min(1, ERROR_CODES.required)
  .refine((value) => !Number.isNaN(Date.parse(value)), ERROR_CODES.date);
const nullableId = idSchema.nullish().transform((value) => value ?? null);

// ---- Tasks ----

export const TASK_STATUSES = ["PENDING", "COMPLETED"] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const taskPrioritySchema = z.enum(["NORMAL", "HIGH"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

/** POST /tasks and PUT /tasks/:id */
export const taskInputSchema = z
  .object({
    title: text(160),
    description: optionalText(5000),
    priority: taskPrioritySchema.default("NORMAL"),
    dueAt: optionalInstant,
    remindAt: optionalInstant,
    assigneeId: nullableId,
    customerId: nullableId,
    opportunityId: nullableId,
    ticketId: nullableId,
    platformId: nullableId,
  })
  .superRefine((value, ctx) => {
    if (value.remindAt && value.dueAt && Date.parse(value.remindAt) > Date.parse(value.dueAt)) {
      ctx.addIssue({ code: "custom", path: ["remindAt"], message: "remindAfterDue" });
    }
  });
export type TaskInput = z.input<typeof taskInputSchema>;

/** PATCH /tasks/:id/status */
export const taskStatusInputSchema = z.object({ status: taskStatusSchema });

/** GET /tasks */
export const taskListQuerySchema = z.object({
  ...pageQuery,
  status: taskStatusSchema.optional(),
  /** Pending tasks past their due date. */
  overdue: z.enum(["1", "true"]).optional(),
  /** An account id, or "me". */
  assigneeId: idSchema.optional(),
  platformId: idSchema.optional(),
  customerId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  ticketId: idSchema.optional(),
});
export type TaskListQuery = z.input<typeof taskListQuerySchema>;

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueAt: z.string().nullable(),
  remindAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  overdue: z.boolean(),
  assignee: refSchema.nullable(),
  createdBy: refSchema.nullable(),
  customer: refSchema.nullable(),
  opportunity: refSchema.nullable(),
  ticket: z.object({ id: z.string(), number: z.number().int(), subject: z.string() }).nullable(),
  platform: platformRefSchema.nullable(),
  createdAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

// ---- Appointments ----

export const APPOINTMENT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** POST /appointments and PUT /appointments/:id */
export const appointmentInputSchema = z
  .object({
    title: text(160),
    description: optionalText(5000),
    location: optionalText(300),
    startsAt: instant,
    endsAt: instant,
    status: appointmentStatusSchema.default("SCHEDULED"),
    remindAt: optionalInstant,
    assigneeId: nullableId,
    customerId: nullableId,
    platformId: nullableId,
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "endBeforeStart" });
    if (value.remindAt && Date.parse(value.remindAt) > Date.parse(value.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["remindAt"], message: "remindAfterStart" });
    }
  });
export type AppointmentInput = z.input<typeof appointmentInputSchema>;

/** GET /appointments */
export const appointmentListQuerySchema = z.object({
  ...pageQuery,
  /** ISO instants; default: from now on. */
  from: optionalInstant.optional(),
  to: optionalInstant.optional(),
  status: appointmentStatusSchema.optional(),
  assigneeId: idSchema.optional(),
  platformId: idSchema.optional(),
  customerId: idSchema.optional(),
});
export type AppointmentListQuery = z.input<typeof appointmentListQuerySchema>;

export const appointmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: appointmentStatusSchema,
  remindAt: z.string().nullable(),
  assignee: refSchema.nullable(),
  createdBy: refSchema.nullable(),
  customer: refSchema.nullable(),
  platform: platformRefSchema.nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
