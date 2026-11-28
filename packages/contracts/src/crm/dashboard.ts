import { z } from "zod";
import { idSchema, refSchema } from "./common";
import { activitySchema } from "./customers";
import { appointmentSchema, taskSchema } from "./agenda";
import { ticketSummarySchema } from "./tickets";

/** GET /dashboard?platformId= */
export const dashboardQuerySchema = z.object({ platformId: idSchema.optional() });

/**
 * The overview: each block is null when the account has no access to that area, so the screen only shows what
 * the person may see. Counts follow the same platform rules as the lists.
 */
export const dashboardSchema = z.object({
  customers: z.object({ customers: z.number().int(), prospects: z.number().int(), newThisMonth: z.number().int() }).nullable(),
  sales: z
    .object({
      open: z.number().int(),
      /** Estimated value of open opportunities, per currency. */
      openValue: z.array(z.object({ currency: z.string(), amount: z.number() })),
      wonThisMonth: z.number().int(),
      lostThisMonth: z.number().int(),
    })
    .nullable(),
  tickets: z
    .object({
      active: z.number().int(),
      urgent: z.number().int(),
      unassigned: z.number().int(),
      resolvedThisMonth: z.number().int(),
      urgentList: z.array(ticketSummarySchema),
    })
    .nullable(),
  tasks: z
    .object({
      pending: z.number().int(),
      overdue: z.number().int(),
      /** Overdue, due soon or high priority pending tasks, most pressing first. */
      urgentList: z.array(taskSchema),
      upcomingAppointments: z.array(appointmentSchema),
    })
    .nullable(),
  /** Latest events from customer histories the account can see. */
  recentActivity: z
    .array(activitySchema.extend({ customer: refSchema }))
    .nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
