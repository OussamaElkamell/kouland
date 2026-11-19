import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const EVERY_MS = 60_000;

/**
 * Sends task and appointment reminders when their time comes: a notification and an email to the assignee.
 * Each reminder is claimed with a conditional update first, so it is sent once even if several API instances run.
 */
@Injectable()
export class ReminderWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReminderWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === "test" || process.env.REMINDERS === "off") return;
    this.timer = setInterval(() => void this.run().catch((error) => this.logger.error(String(error))), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<number> {
    let sent = 0;
    const tasks = await this.prisma.task.findMany({
      where: { status: "PENDING", remindAt: { lte: now }, reminderSentAt: null, assigneeId: { not: null } },
      select: { id: true, title: true, dueAt: true, assigneeId: true },
      take: 100,
    });
    for (const task of tasks) {
      const { count } = await this.prisma.task.updateMany({ where: { id: task.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (count === 0) continue;
      await this.notifications.notify({
        userIds: [task.assigneeId],
        type: "TASK_REMINDER",
        data: { title: task.title, when: task.dueAt?.toISOString() ?? null },
        link: `/admin/agenda?task=${task.id}`,
      });
      sent++;
    }
    const appointments = await this.prisma.appointment.findMany({
      where: { status: "SCHEDULED", remindAt: { lte: now }, reminderSentAt: null, assigneeId: { not: null } },
      select: { id: true, title: true, startsAt: true, assigneeId: true },
      take: 100,
    });
    for (const appointment of appointments) {
      const { count } = await this.prisma.appointment.updateMany({ where: { id: appointment.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (count === 0) continue;
      await this.notifications.notify({
        userIds: [appointment.assigneeId],
        type: "APPOINTMENT_REMINDER",
        data: { title: appointment.title, when: appointment.startsAt.toISOString() },
        link: `/admin/agenda?tab=appointments&appointment=${appointment.id}`,
      });
      sent++;
    }
    return sent;
  }
}
