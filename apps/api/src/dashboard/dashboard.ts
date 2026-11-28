import { Controller, ForbiddenException, Get, Injectable, Module, Query } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ACTIVE_TICKET_STATUSES, HIGH_PRIORITIES, OPEN_STATUSES, dashboardQuerySchema, levelAllows, type Dashboard } from "@kouland/contracts";
import type { z } from "zod";
import { APPOINTMENT_SELECT, TASK_SELECT, agendaScopeWhere, toAppointment, toTask } from "../agenda/agenda.service";
import { canUsePlatform, CurrentUser, platformScope, type AuthUser } from "../auth/auth-user";
import { Crm } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ACTIVITY_SELECT, toActivity } from "../customers/activity.service";
import { customerScopeWhere } from "../customers/customer-access";
import { PrismaService } from "../prisma/prisma.service";
import { TICKET_SUMMARY_SELECT, ticketScopeWhere, toTicketSummary } from "../tickets/tickets.service";

const DAY = 86_400_000;

/**
 * The overview of the business: statistics, urgent tickets and tasks, upcoming appointments and recent activity.
 * Every block uses the same access and platform rules as its own list, and is left out without access.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser, platformId?: string): Promise<Dashboard> {
    if (platformId && !canUsePlatform(user, platformId)) throw new ForbiddenException("You do not have access to this platform.");
    const can = (area: keyof AuthUser["access"]) => levelAllows(user.access[area], "VIEW");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [customers, sales, tickets, tasks, recentActivity] = await Promise.all([
      can("CUSTOMERS") ? this.customers(user, platformId, monthStart) : null,
      can("SALES") ? this.sales(user, platformId, monthStart) : null,
      can("TICKETS") ? this.tickets(user, platformId, monthStart) : null,
      can("TASKS") ? this.tasks(user, platformId, now) : null,
      can("CUSTOMERS") ? this.activity(user, platformId) : null,
    ]);
    return { customers, sales, tickets, tasks, recentActivity };
  }

  private async customers(user: AuthUser, platformId: string | undefined, monthStart: Date) {
    const base: Prisma.CustomerWhereInput = { AND: [customerScopeWhere(user), platformId ? { platforms: { some: { platformId } } } : {}] };
    const [customers, prospects, newThisMonth] = await Promise.all([
      this.prisma.customer.count({ where: { ...base, stage: "CUSTOMER" } }),
      this.prisma.customer.count({ where: { ...base, stage: "PROSPECT" } }),
      this.prisma.customer.count({ where: { ...base, createdAt: { gte: monthStart } } }),
    ]);
    return { customers, prospects, newThisMonth };
  }

  private async sales(user: AuthUser, platformId: string | undefined, monthStart: Date) {
    const scope = platformScope(user);
    const base: Prisma.OpportunityWhereInput = { AND: [scope ? { platformId: { in: scope } } : {}, platformId ? { platformId } : {}] };
    const open: Prisma.OpportunityWhereInput = { ...base, status: { in: [...OPEN_STATUSES] } };
    const [openCount, values, wonThisMonth, lostThisMonth] = await Promise.all([
      this.prisma.opportunity.count({ where: open }),
      this.prisma.opportunity.groupBy({ by: ["currency"], where: open, _sum: { estimatedValue: true } }),
      this.prisma.opportunity.count({ where: { ...base, status: "WON", closedAt: { gte: monthStart } } }),
      this.prisma.opportunity.count({ where: { ...base, status: "LOST", closedAt: { gte: monthStart } } }),
    ]);
    return {
      open: openCount,
      openValue: values.map((value) => ({ currency: value.currency, amount: value._sum.estimatedValue?.toNumber() ?? 0 })).filter((value) => value.amount > 0),
      wonThisMonth,
      lostThisMonth,
    };
  }

  private async tickets(user: AuthUser, platformId: string | undefined, monthStart: Date) {
    const base: Prisma.TicketWhereInput = { AND: [ticketScopeWhere(user), platformId ? { platformId } : {}] };
    const active: Prisma.TicketWhereInput = { ...base, status: { in: [...ACTIVE_TICKET_STATUSES] } };
    const urgentWhere: Prisma.TicketWhereInput = { ...active, priority: { in: [...HIGH_PRIORITIES] } };
    const [activeCount, urgent, unassigned, resolvedThisMonth, urgentRows] = await Promise.all([
      this.prisma.ticket.count({ where: active }),
      this.prisma.ticket.count({ where: urgentWhere }),
      this.prisma.ticket.count({ where: { ...active, assigneeId: null } }),
      this.prisma.ticket.count({ where: { ...base, resolvedAt: { gte: monthStart } } }),
      this.prisma.ticket.findMany({ where: urgentWhere, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 5, select: TICKET_SUMMARY_SELECT }),
    ]);
    return { active: activeCount, urgent, unassigned, resolvedThisMonth, urgentList: urgentRows.map(toTicketSummary) };
  }

  private async tasks(user: AuthUser, platformId: string | undefined, now: Date) {
    const scope = agendaScopeWhere(user);
    const pending: Prisma.TaskWhereInput = { AND: [scope as Prisma.TaskWhereInput, platformId ? { platformId } : {}, { status: "PENDING" }] };
    const [pendingCount, overdue, urgentRows, appointments] = await Promise.all([
      this.prisma.task.count({ where: pending }),
      this.prisma.task.count({ where: { AND: [pending, { dueAt: { lt: now } }] } }),
      // Urgent: overdue, due within two days, or marked high priority.
      this.prisma.task.findMany({
        where: { AND: [pending, { OR: [{ dueAt: { lt: new Date(now.getTime() + 2 * DAY) } }, { priority: "HIGH" }] }] },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
        take: 6,
        select: TASK_SELECT,
      }),
      this.prisma.appointment.findMany({
        where: {
          AND: [scope as Prisma.AppointmentWhereInput, platformId ? { platformId } : {}, { status: "SCHEDULED", endsAt: { gte: now }, startsAt: { lte: new Date(now.getTime() + 7 * DAY) } }],
        },
        orderBy: { startsAt: "asc" },
        take: 6,
        select: APPOINTMENT_SELECT,
      }),
    ]);
    return { pending: pendingCount, overdue, urgentList: urgentRows.map(toTask), upcomingAppointments: appointments.map(toAppointment) };
  }

  private async activity(user: AuthUser, platformId: string | undefined) {
    const rows = await this.prisma.activity.findMany({
      where: { customer: { AND: [customerScopeWhere(user), platformId ? { platforms: { some: { platformId } } } : {}] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { ...ACTIVITY_SELECT, customer: { select: { id: true, displayName: true } } },
    });
    return rows.map(({ customer, ...row }) => ({ ...toActivity(row), customer: { id: customer.id, name: customer.displayName } }));
  }
}

@Controller("dashboard")
@Crm()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(dashboardQuerySchema)) query: z.output<typeof dashboardQuerySchema>): Promise<Dashboard> {
    return this.dashboard.get(user, query.platformId);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
