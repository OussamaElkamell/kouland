import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma, TicketStatus } from "@prisma/client";
import {
  ACTIVE_TICKET_STATUSES,
  HIGH_PRIORITIES,
  type ApiErrorBody,
  type Page,
  type SupportReceipt,
  type TicketDetail,
  type TicketSummary,
  type TicketUpdate,
  createTicketSchema,
  supportRequestSchema,
  ticketListQuerySchema,
  updateTicketSchema,
} from "@kouland/contracts";
import type { z } from "zod";
import { canUsePlatform, platformScope, type AuthUser } from "../auth/auth-user";
import { notFound } from "../common/prisma-errors";
import { ActivityService } from "../customers/activity.service";
import { CustomerAccess } from "../customers/customer-access";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

export const TICKET_SUMMARY_SELECT = {
  id: true,
  number: true,
  subject: true,
  status: true,
  priority: true,
  source: true,
  requesterName: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, displayName: true } },
  platform: { select: { id: true, name: true, slug: true, color: true } },
  department: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

type SummaryRow = Prisma.TicketGetPayload<{ select: typeof TICKET_SUMMARY_SELECT }>;

export function toTicketSummary({ customer, createdAt, updatedAt, ...row }: SummaryRow): TicketSummary {
  return {
    ...row,
    customer: customer ? { id: customer.id, name: customer.displayName } : null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * Tickets the account may see: those of its platforms and those assigned to it. Tickets without a platform are
 * seen by all-platform accounts (and their assignee).
 */
export function ticketScopeWhere(user: AuthUser): Prisma.TicketWhereInput {
  const scope = platformScope(user);
  return scope ? { OR: [{ platformId: { in: scope } }, { assigneeId: user.id }] } : {};
}

const badRequest = (field: string, message: string) => {
  const body: ApiErrorBody = { statusCode: 400, message, fieldErrors: { [field]: ["invalid"] } };
  return new BadRequestException(body);
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerAccess: CustomerAccess,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, query: z.output<typeof ticketListQuerySchema>): Promise<Page<TicketSummary>> {
    const where: Prisma.TicketWhereInput = {
      AND: [
        ticketScopeWhere(user),
        query.status ? { status: query.status } : {},
        query.state === "active" ? { status: { in: [...ACTIVE_TICKET_STATUSES] } } : query.state === "done" ? { status: { in: ["RESOLVED", "CLOSED"] } } : {},
        query.priority ? { priority: query.priority } : query.urgent ? { priority: { in: [...HIGH_PRIORITIES] } } : {},
        query.platformId ? { platformId: query.platformId } : {},
        query.departmentId ? { departmentId: query.departmentId } : {},
        query.assigneeId ? { assigneeId: query.assigneeId === "me" ? user.id : query.assigneeId === "none" ? null : query.assigneeId } : {},
        query.customerId ? { customerId: query.customerId } : {},
        query.q
          ? {
              OR: [
                { subject: { contains: query.q, mode: "insensitive" } },
                { requesterName: { contains: query.q, mode: "insensitive" } },
                { requesterEmail: { contains: query.q, mode: "insensitive" } },
                { customer: { displayName: { contains: query.q, mode: "insensitive" } } },
                ...(/^#?\d+$/.test(query.q) ? [{ number: Number(query.q.replace("#", "")) }] : []),
              ],
            }
          : {},
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        // Most urgent first, then the oldest still waiting.
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: TICKET_SUMMARY_SELECT,
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows.map(toTicketSummary) };
  }

  async get(user: AuthUser, id: string): Promise<TicketDetail> {
    const row = await this.prisma.ticket.findFirst({
      where: { id, ...ticketScopeWhere(user) },
      select: {
        ...TICKET_SUMMARY_SELECT,
        description: true,
        requesterEmail: true,
        requesterPhone: true,
        resolvedAt: true,
        createdBy: { select: { id: true, name: true } },
        updates: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!row) throw notFound("Ticket");
    const { description, requesterEmail, requesterPhone, resolvedAt, createdBy, updates, ...summary } = row;
    return {
      ...toTicketSummary(summary),
      description,
      requesterEmail,
      requesterPhone,
      createdBy,
      resolvedAt: resolvedAt?.toISOString() ?? null,
      updates: updates.map(toUpdate),
    };
  }

  async create(user: AuthUser, input: z.output<typeof createTicketSchema>): Promise<{ id: string }> {
    await this.checkLinks(user, input);
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: { ...input, source: "STAFF", createdById: user.id },
        select: { id: true, number: true, subject: true, customerId: true },
      });
      if (created.customerId) {
        await this.activity.record(
          { customerId: created.customerId, ticketId: created.id, type: "TICKET_CREATED", userId: user.id, data: { number: created.number, title: created.subject } },
          tx,
        );
      }
      return created;
    });
    await this.announce(ticket, input.platformId, input.assigneeId, user);
    return { id: ticket.id };
  }

  /** The "Report an issue" form on kouland.com. Linked to the customer whose email matches, if any. */
  async createFromWebsite(input: z.output<typeof supportRequestSchema>): Promise<SupportReceipt> {
    if (input.platformId && !(await this.prisma.platform.findFirst({ where: { id: input.platformId, isActive: true }, select: { id: true } }))) {
      throw badRequest("platformId", "This service does not exist.");
    }
    const customer = await this.prisma.customer.findFirst({
      where: { OR: [{ email: { equals: input.email, mode: "insensitive" } }, { contacts: { some: { email: { equals: input.email, mode: "insensitive" } } } }] },
      select: { id: true },
    });
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          subject: input.subject,
          description: input.description,
          platformId: input.platformId,
          customerId: customer?.id ?? null,
          source: "WEBSITE",
          requesterName: input.name,
          requesterEmail: input.email,
          requesterPhone: input.phone,
        },
        select: { id: true, number: true, subject: true, customerId: true },
      });
      if (created.customerId) {
        await this.activity.record(
          { customerId: created.customerId, ticketId: created.id, type: "TICKET_CREATED", data: { number: created.number, title: created.subject, website: true } },
          tx,
        );
      }
      return created;
    });
    await this.announce(ticket, input.platformId, null, null);
    return { number: ticket.number };
  }

  /** Changes status, priority, department, assignee or text; each change is written in the ticket's progress. */
  async update(user: AuthUser, id: string, input: z.output<typeof updateTicketSchema>): Promise<{ id: string }> {
    const current = await this.prisma.ticket.findFirst({ where: { id, ...ticketScopeWhere(user) } });
    if (!current) throw notFound("Ticket");
    await this.checkLinks(user, {
      customerId: input.customerId !== undefined && input.customerId !== current.customerId ? input.customerId : null,
      platformId: input.platformId !== undefined && input.platformId !== current.platformId ? input.platformId : null,
      departmentId: input.departmentId !== undefined && input.departmentId !== current.departmentId ? input.departmentId : null,
      assigneeId: input.assigneeId !== undefined && input.assigneeId !== current.assigneeId ? input.assigneeId : null,
    }, input.platformId !== undefined && input.platformId !== current.platformId);

    const changes: Prisma.TicketUpdateCreateManyInput[] = [];
    const record = (type: Prisma.TicketUpdateCreateManyInput["type"], from: unknown, to: unknown, extra: Record<string, unknown> = {}) =>
      changes.push({ ticketId: id, type, userId: user.id, data: { from, to, ...extra } as Prisma.InputJsonObject });

    if (input.status && input.status !== current.status) record("STATUS", current.status, input.status);
    if (input.priority && input.priority !== current.priority) record("PRIORITY", current.priority, input.priority);
    if (input.departmentId !== undefined && input.departmentId !== current.departmentId) {
      const names = await this.names("department", [current.departmentId, input.departmentId]);
      record("DEPARTMENT", names.get(current.departmentId) ?? null, names.get(input.departmentId) ?? null);
    }
    if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
      const names = await this.names("user", [current.assigneeId, input.assigneeId]);
      record("ASSIGNED", names.get(current.assigneeId) ?? null, names.get(input.assigneeId) ?? null);
    }

    const status = input.status ?? current.status;
    const done = status === "RESOLVED" || status === "CLOSED";
    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: { ...input, resolvedAt: done ? (current.resolvedAt ?? new Date()) : null },
      });
      if (changes.length) await tx.ticketUpdate.createMany({ data: changes });
      const customerId = input.customerId !== undefined ? input.customerId : current.customerId;
      if (customerId && input.status && input.status !== current.status) {
        await this.activity.record(
          { customerId, ticketId: id, type: "TICKET_STATUS", userId: user.id, data: { number: current.number, title: current.subject, from: current.status, to: input.status } },
          tx,
        );
      }
    });

    const link = `/admin/tickets/${id}`;
    if (input.assigneeId && input.assigneeId !== current.assigneeId) {
      await this.notifications.notify({
        userIds: [input.assigneeId],
        type: "TICKET_ASSIGNED",
        data: { number: current.number, title: current.subject, by: user.name },
        link,
        actorId: user.id,
      });
    }
    // Important status update: the person who opened it and the assignee hear when it is resolved or closed.
    if (input.status && input.status !== current.status && (done || input.status === "WAITING_ON_CUSTOMER")) {
      await this.notifications.notify({
        userIds: [current.createdById, current.assigneeId],
        type: "TICKET_STATUS",
        data: { number: current.number, title: current.subject, status: input.status, by: user.name },
        link,
        actorId: user.id,
      });
    }
    return { id };
  }

  async comment(user: AuthUser, id: string, body: string): Promise<TicketUpdate> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, ...ticketScopeWhere(user) }, select: { id: true } });
    if (!ticket) throw notFound("Ticket");
    const row = await this.prisma.ticketUpdate.create({
      data: { ticketId: id, type: "COMMENT", body, userId: user.id },
      include: { user: { select: { id: true, name: true } } },
    });
    await this.prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
    return toUpdate(row);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, ...ticketScopeWhere(user) }, select: { id: true } });
    if (!ticket) throw notFound("Ticket");
    await this.prisma.ticket.delete({ where: { id } });
  }

  // ---- Helpers ----

  /** New ticket: the people handling tickets for that platform, and the assignee (with an email). */
  private async announce(
    ticket: { id: string; number: number; subject: string },
    platformId: string | null,
    assigneeId: string | null,
    actor: AuthUser | null,
  ): Promise<void> {
    const link = `/admin/tickets/${ticket.id}`;
    const staff = await this.notifications.peopleWithAccess("TICKETS", "EDIT", platformId);
    await this.notifications.notify({
      userIds: staff.filter((id) => id !== assigneeId),
      type: "NEW_TICKET",
      data: { number: ticket.number, title: ticket.subject },
      link,
      actorId: actor?.id,
    });
    if (assigneeId) {
      await this.notifications.notify({
        userIds: [assigneeId],
        type: "TICKET_ASSIGNED",
        data: { number: ticket.number, title: ticket.subject, by: actor?.name ?? "Kouland CRM" },
        link,
        actorId: actor?.id,
      });
    }
  }

  /** Customer visible to the account, platform allowed and active, department active, assignee able to handle tickets. */
  private async checkLinks(
    user: AuthUser,
    links: { customerId: string | null; platformId: string | null; departmentId: string | null; assigneeId: string | null },
    /** False when the platform is not being set or changed. */
    platformChanging = true,
  ): Promise<void> {
    if (links.customerId) await this.customerAccess.visibleCustomer(user, links.customerId);
    if (links.platformId) {
      if (!canUsePlatform(user, links.platformId)) throw badRequest("platformId", "You do not have access to this platform.");
      if (!(await this.prisma.platform.findFirst({ where: { id: links.platformId, isActive: true }, select: { id: true } }))) {
        throw badRequest("platformId", "This platform does not exist or is inactive.");
      }
    } else if (platformChanging && platformScope(user)) {
      // A manager or employee would lose sight of a ticket without one of their platforms.
      throw badRequest("platformId", "Choose one of your platforms.");
    }
    if (links.departmentId && !(await this.prisma.department.findFirst({ where: { id: links.departmentId, isActive: true }, select: { id: true } }))) {
      throw badRequest("departmentId", "This department does not exist or is inactive.");
    }
    if (links.assigneeId) {
      const ok = await this.prisma.user.findFirst({
        where: {
          id: links.assigneeId,
          isActive: true,
          OR: [{ role: "ADMIN" }, { permissions: { some: { area: "TICKETS", level: { in: ["EDIT", "MANAGE"] } } } }],
        },
        select: { id: true },
      });
      if (!ok) throw badRequest("assigneeId", "This person cannot handle tickets.");
    }
  }

  private async names(kind: "department" | "user", ids: Array<string | null>): Promise<Map<string | null, string>> {
    const wanted = ids.filter((id): id is string => Boolean(id));
    const rows =
      kind === "department"
        ? await this.prisma.department.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } })
        : await this.prisma.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}

function toUpdate(row: {
  id: string;
  type: TicketUpdate["type"];
  body: string | null;
  data: Prisma.JsonValue;
  createdAt: Date;
  user: { id: string; name: string } | null;
}): TicketUpdate {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    data: row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : null,
    user: row.user,
    createdAt: row.createdAt.toISOString(),
  };
}

export type { TicketStatus };
