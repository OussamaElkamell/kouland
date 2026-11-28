import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AccessLevel, NotificationType, PermissionArea, Prisma } from "@prisma/client";
import { crmLocaleSchema, type NotificationList } from "@kouland/contracts";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { buildNotificationEmail, formatWhen, type EmailedType } from "./notification-email";

const EMAILED: readonly NotificationType[] = ["TICKET_ASSIGNED", "TASK_ASSIGNED", "APPOINTMENT_ASSIGNED", "TASK_REMINDER", "APPOINTMENT_REMINDER"];
const LEVELS_AT_LEAST: Record<AccessLevel, AccessLevel[]> = { VIEW: ["VIEW", "EDIT", "MANAGE"], EDIT: ["EDIT", "MANAGE"], MANAGE: ["MANAGE"] };

export interface NotifyInput {
  userIds: Array<string | null | undefined>;
  type: NotificationType;
  /** Words for the screen: titles, numbers, names, statuses. `when` (ISO) is worded per person in emails. */
  data: Record<string, string | number | null>;
  /** CRM address, e.g. /admin/tickets/<id>. */
  link: string;
  /** The person who caused it; never notified about their own action. */
  actorId?: string | null;
}

/**
 * In-app notifications (the bell) for new leads, tickets, assignments, reminders and important status changes.
 * Assignments and reminders are also emailed to the person. Sending never fails the action that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailSender,
    private readonly config: ConfigService,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const ids = [...new Set(input.userIds.filter((id): id is string => Boolean(id) && id !== input.actorId))];
    if (ids.length === 0) return;
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true, email: true, name: true, locale: true },
      });
      await this.prisma.notification.createMany({
        data: users.map((user) => ({ userId: user.id, type: input.type, data: input.data as Prisma.InputJsonObject, link: input.link })),
      });
      if (EMAILED.includes(input.type) && this.config.get<string>("BREVO_API_KEY")) {
        await Promise.all(users.map((user) => this.email(user, input)));
      }
    } catch (error) {
      this.logger.error(`Notification ${input.type} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Active accounts with at least `level` on `area` that work on `platformId` (administrators and all-platform
   * accounts always; a null platform reaches only them).
   */
  async peopleWithAccess(area: PermissionArea, level: AccessLevel, platformId: string | null): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: "ADMIN" },
          {
            permissions: { some: { area, level: { in: LEVELS_AT_LEAST[level] } } },
            OR: [{ allPlatforms: true }, ...(platformId ? [{ platforms: { some: { platformId } } }] : [])],
          },
        ],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async list(userId: string): Promise<NotificationList> {
    const [items, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        data: item.data && typeof item.data === "object" && !Array.isArray(item.data) ? (item.data as Record<string, unknown>) : {},
        link: item.link,
        read: item.readAt !== null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async markRead(userId: string, id?: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  }

  private async email(user: { email: string; name: string; locale: string }, input: NotifyInput): Promise<void> {
    const locale = crmLocaleSchema.catch("en").parse(user.locale);
    const data = Object.fromEntries(Object.entries(input.data).map(([key, value]) => [key, value === null ? "" : String(value)]));
    data.when = formatWhen(data.when, locale);
    const email = buildNotificationEmail({ type: input.type as EmailedType, locale, name: user.name, data, url: `${this.appUrl()}${input.link}` });
    try {
      await this.mail.send({ to: [{ email: user.email, name: user.name }], subject: email.subject, html: email.html, text: email.text, tag: `crm-${input.type.toLowerCase()}` });
    } catch (error) {
      this.logger.error(`Email for ${input.type} to ${user.email} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private appUrl(): string {
    const configured = this.config.get<string>("APP_URL") || (this.config.get<string>("CORS_ORIGINS") ?? "").split(",")[0];
    return configured?.trim().replace(/\/+$/, "") || "http://localhost:3100";
  }
}
