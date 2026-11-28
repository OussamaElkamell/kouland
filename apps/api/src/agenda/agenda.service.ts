import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  type ApiErrorBody,
  type Appointment,
  type Page,
  type Task,
  appointmentInputSchema,
  appointmentListQuerySchema,
  taskInputSchema,
  taskListQuerySchema,
} from "@kouland/contracts";
import type { z } from "zod";
import { canUsePlatform, platformScope, type AuthUser } from "../auth/auth-user";
import { notFound } from "../common/prisma-errors";
import { ActivityService } from "../customers/activity.service";
import { CustomerAccess } from "../customers/customer-access";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

type TaskInput = z.output<typeof taskInputSchema>;
type AppointmentInput = z.output<typeof appointmentInputSchema>;

const PLATFORM = { select: { id: true, name: true, slug: true, color: true } } as const;
const PERSON = { select: { id: true, name: true } } as const;

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  remindAt: true,
  completedAt: true,
  createdAt: true,
  assignee: PERSON,
  createdBy: PERSON,
  customer: { select: { id: true, displayName: true } },
  opportunity: { select: { id: true, title: true } },
  ticket: { select: { id: true, number: true, subject: true } },
  platform: PLATFORM,
} satisfies Prisma.TaskSelect;

export const APPOINTMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  status: true,
  remindAt: true,
  assignee: PERSON,
  createdBy: PERSON,
  customer: { select: { id: true, displayName: true } },
  platform: PLATFORM,
} satisfies Prisma.AppointmentSelect;

const iso = (value: Date | null) => value?.toISOString() ?? null;

export function toTask({ customer, opportunity, dueAt, remindAt, completedAt, createdAt, ...row }: Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>): Task {
  return {
    ...row,
    dueAt: iso(dueAt),
    remindAt: iso(remindAt),
    completedAt: iso(completedAt),
    createdAt: createdAt.toISOString(),
    overdue: row.status === "PENDING" && dueAt !== null && dueAt < new Date(),
    customer: customer ? { id: customer.id, name: customer.displayName } : null,
    opportunity: opportunity ? { id: opportunity.id, name: opportunity.title } : null,
  };
}

export function toAppointment({ customer, startsAt, endsAt, remindAt, ...row }: Prisma.AppointmentGetPayload<{ select: typeof APPOINTMENT_SELECT }>): Appointment {
  return {
    ...row,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    remindAt: iso(remindAt),
    customer: customer ? { id: customer.id, name: customer.displayName } : null,
  };
}

/**
 * Tasks and appointments the account may see: its platforms', plus those assigned to it or created by it
 * (personal items without a platform). All-platform accounts see everything.
 */
export function agendaScopeWhere(user: AuthUser): { OR?: Array<Record<string, unknown>> } {
  const scope = platformScope(user);
  return scope ? { OR: [{ platformId: { in: scope } }, { assigneeId: user.id }, { createdById: user.id }] } : {};
}

const badRequest = (field: string, message: string) => {
  const body: ApiErrorBody = { statusCode: 400, message, fieldErrors: { [field]: ["invalid"] } };
  return new BadRequestException(body);
};

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerAccess: CustomerAccess,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Tasks ----

  async listTasks(user: AuthUser, query: z.output<typeof taskListQuerySchema>): Promise<Page<Task>> {
    const now = new Date();
    const where: Prisma.TaskWhereInput = {
      AND: [
        agendaScopeWhere(user) as Prisma.TaskWhereInput,
        query.overdue ? { status: "PENDING", dueAt: { lt: now } } : query.status ? { status: query.status } : {},
        query.assigneeId ? { assigneeId: query.assigneeId === "me" ? user.id : query.assigneeId } : {},
        query.platformId ? { platformId: query.platformId } : {},
        query.customerId ? { customerId: query.customerId } : {},
        query.opportunityId ? { opportunityId: query.opportunityId } : {},
        query.ticketId ? { ticketId: query.ticketId } : {},
        query.q ? { title: { contains: query.q, mode: "insensitive" } } : {},
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        // Pending first; the soonest due first (no date last); completed ones most recent first.
        orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { completedAt: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: TASK_SELECT,
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows.map(toTask) };
  }

  async createTask(user: AuthUser, input: TaskInput): Promise<Task> {
    await this.checkLinks(user, input, "TASKS");
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({ data: { ...toDates(input), createdById: user.id }, select: TASK_SELECT });
      if (input.customerId) {
        await this.activity.record(
          { customerId: input.customerId, opportunityId: input.opportunityId ?? undefined, type: "TASK_CREATED", userId: user.id, data: { title: created.title } },
          tx,
        );
      }
      return created;
    });
    await this.notifyTaskAssignee(user, row.id, input.assigneeId, null, row.title, input.dueAt);
    return toTask(row);
  }

  async updateTask(user: AuthUser, id: string, input: TaskInput): Promise<Task> {
    const current = await this.findTask(user, id);
    await this.checkLinks(user, input, "TASKS");
    const row = await this.prisma.task.update({
      where: { id },
      // A new reminder time sends a new reminder.
      data: { ...toDates(input), ...(sameTime(current.remindAt, input.remindAt) ? {} : { reminderSentAt: null }) },
      select: TASK_SELECT,
    });
    await this.notifyTaskAssignee(user, id, input.assigneeId, current.assigneeId, row.title, input.dueAt);
    return toTask(row);
  }

  async setTaskStatus(user: AuthUser, id: string, status: "PENDING" | "COMPLETED"): Promise<Task> {
    const current = await this.findTask(user, id);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: { status, completedAt: status === "COMPLETED" ? (current.completedAt ?? new Date()) : null },
        select: TASK_SELECT,
      });
      if (status === "COMPLETED" && current.status !== "COMPLETED" && current.customerId) {
        await this.activity.record({ customerId: current.customerId, type: "TASK_COMPLETED", userId: user.id, data: { title: current.title } }, tx);
      }
      return updated;
    });
    return toTask(row);
  }

  async removeTask(user: AuthUser, id: string): Promise<void> {
    await this.findTask(user, id);
    await this.prisma.task.delete({ where: { id } });
  }

  // ---- Appointments ----

  async listAppointments(user: AuthUser, query: z.output<typeof appointmentListQuerySchema>): Promise<Page<Appointment>> {
    const from = query.from ? new Date(query.from) : query.to ? undefined : new Date(Date.now() - 3_600_000);
    const where: Prisma.AppointmentWhereInput = {
      AND: [
        agendaScopeWhere(user) as Prisma.AppointmentWhereInput,
        // Default: from an hour ago on, so a meeting in progress still shows.
        { endsAt: from ? { gte: from } : undefined, startsAt: query.to ? { lte: new Date(query.to) } : undefined },
        query.status ? { status: query.status } : {},
        query.assigneeId ? { assigneeId: query.assigneeId === "me" ? user.id : query.assigneeId } : {},
        query.platformId ? { platformId: query.platformId } : {},
        query.customerId ? { customerId: query.customerId } : {},
        query.q ? { title: { contains: query.q, mode: "insensitive" } } : {},
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, orderBy: { startsAt: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: APPOINTMENT_SELECT }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows.map(toAppointment) };
  }

  async createAppointment(user: AuthUser, input: AppointmentInput): Promise<Appointment> {
    await this.checkLinks(user, input, "TASKS");
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({ data: { ...toAppointmentDates(input), createdById: user.id }, select: APPOINTMENT_SELECT });
      if (input.customerId) {
        await this.activity.record(
          { customerId: input.customerId, type: "APPOINTMENT_SCHEDULED", userId: user.id, data: { title: created.title, when: created.startsAt.toISOString() } },
          tx,
        );
      }
      return created;
    });
    await this.notifyAppointmentAssignee(user, row.id, input.assigneeId, null, row.title, input.startsAt);
    return toAppointment(row);
  }

  async updateAppointment(user: AuthUser, id: string, input: AppointmentInput): Promise<Appointment> {
    const current = await this.prisma.appointment.findFirst({ where: { id, ...(agendaScopeWhere(user) as Prisma.AppointmentWhereInput) } });
    if (!current) throw notFound("Appointment");
    await this.checkLinks(user, input, "TASKS");
    const row = await this.prisma.appointment.update({
      where: { id },
      data: { ...toAppointmentDates(input), ...(sameTime(current.remindAt, input.remindAt) ? {} : { reminderSentAt: null }) },
      select: APPOINTMENT_SELECT,
    });
    await this.notifyAppointmentAssignee(user, id, input.assigneeId, current.assigneeId, row.title, input.startsAt);
    return toAppointment(row);
  }

  async removeAppointment(user: AuthUser, id: string): Promise<void> {
    const current = await this.prisma.appointment.findFirst({ where: { id, ...(agendaScopeWhere(user) as Prisma.AppointmentWhereInput) }, select: { id: true } });
    if (!current) throw notFound("Appointment");
    await this.prisma.appointment.delete({ where: { id } });
  }

  // ---- Helpers ----

  private async findTask(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, ...(agendaScopeWhere(user) as Prisma.TaskWhereInput) } });
    if (!task) throw notFound("Task");
    return task;
  }

  private async notifyTaskAssignee(user: AuthUser, id: string, assigneeId: string | null, before: string | null, title: string, dueAt: string | null) {
    if (!assigneeId || assigneeId === before) return;
    await this.notifications.notify({ userIds: [assigneeId], type: "TASK_ASSIGNED", data: { title, by: user.name, when: dueAt }, link: `/admin/agenda?task=${id}`, actorId: user.id });
  }

  private async notifyAppointmentAssignee(user: AuthUser, id: string, assigneeId: string | null, before: string | null, title: string, startsAt: string) {
    if (!assigneeId || assigneeId === before) return;
    await this.notifications.notify({
      userIds: [assigneeId],
      type: "APPOINTMENT_ASSIGNED",
      data: { title, by: user.name, when: startsAt },
      link: `/admin/agenda?tab=appointments&appointment=${id}`,
      actorId: user.id,
    });
  }

  /** Linked records must exist and be visible; the platform must be the account's; the assignee must work on tasks. */
  private async checkLinks(
    user: AuthUser,
    input: { assigneeId: string | null; customerId: string | null; platformId: string | null; opportunityId?: string | null; ticketId?: string | null },
    area: "TASKS",
  ): Promise<void> {
    if (input.customerId) await this.customerAccess.visibleCustomer(user, input.customerId);
    if (input.platformId) {
      if (!canUsePlatform(user, input.platformId)) throw badRequest("platformId", "You do not have access to this platform.");
      if (!(await this.prisma.platform.findFirst({ where: { id: input.platformId, isActive: true }, select: { id: true } }))) {
        throw badRequest("platformId", "This platform does not exist or is inactive.");
      }
    }
    if (input.opportunityId && !(await this.prisma.opportunity.findUnique({ where: { id: input.opportunityId }, select: { id: true } }))) {
      throw badRequest("opportunityId", "This opportunity does not exist.");
    }
    if (input.ticketId && !(await this.prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { id: true } }))) {
      throw badRequest("ticketId", "This ticket does not exist.");
    }
    if (input.assigneeId && input.assigneeId !== user.id) {
      const ok = await this.prisma.user.findFirst({
        where: { id: input.assigneeId, isActive: true, OR: [{ role: "ADMIN" }, { permissions: { some: { area, level: { in: ["EDIT", "MANAGE"] } } } }] },
        select: { id: true },
      });
      if (!ok) throw badRequest("assigneeId", "This person cannot be given tasks.");
    }
  }
}

function toDates(input: TaskInput) {
  return { ...input, dueAt: input.dueAt ? new Date(input.dueAt) : null, remindAt: input.remindAt ? new Date(input.remindAt) : null };
}

function toAppointmentDates(input: AppointmentInput) {
  return { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), remindAt: input.remindAt ? new Date(input.remindAt) : null };
}

function sameTime(current: Date | null, next: string | null): boolean {
  return (current?.getTime() ?? null) === (next ? new Date(next).getTime() : null);
}
