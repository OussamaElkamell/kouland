import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "NEW_LEAD",
  "NEW_TICKET",
  "TICKET_ASSIGNED",
  "TICKET_STATUS",
  "TASK_ASSIGNED",
  "TASK_REMINDER",
  "APPOINTMENT_ASSIGNED",
  "APPOINTMENT_REMINDER",
  "OPPORTUNITY_STATUS",
  "MISSED_CALL",
  "NEW_SMS",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  /** Details for the screen to word it (titles, numbers, names, statuses). */
  data: z.record(z.string(), z.unknown()),
  link: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

/** GET /notifications: the latest notifications and how many are unread. */
export const notificationListSchema = z.object({ items: z.array(notificationSchema), unread: z.number().int() });
export type NotificationList = z.infer<typeof notificationListSchema>;
