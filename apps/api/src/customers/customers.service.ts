import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  customerDisplayName,
  type ApiErrorBody,
  type Contact,
  type CustomerDetail,
  type CustomerFields,
  type CustomerStage,
  type CustomerSummary,
  type Page,
  contactInputSchema,
  customerInputSchema,
  customerListQuerySchema,
  noteInputSchema,
  OPEN_STATUSES,
} from "@kouland/contracts";
import type { z } from "zod";
import { platformScope, type AuthUser } from "../auth/auth-user";
import { notFound } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVITY_SELECT, ActivityService, toActivity } from "./activity.service";
import { CustomerAccess, customerScopeWhere } from "./customer-access";

const PLATFORM_REF = { select: { platform: { select: { id: true, name: true, slug: true, color: true } } } } as const;
const CONTACT_SELECT = { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true, isPrimary: true } as const;
const HISTORY_LIMIT = 200;

/** Fields compared to describe an update in the customer's history. */
const TRACKED_FIELDS = [
  "type",
  "firstName",
  "lastName",
  "companyName",
  "email",
  "phone",
  "website",
  "addressLine",
  "city",
  "region",
  "postalCode",
  "country",
  "notes",
] as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CustomerAccess,
    private readonly activity: ActivityService,
  ) {}

  async list(user: AuthUser, query: z.output<typeof customerListQuerySchema>): Promise<Page<CustomerSummary>> {
    const where: Prisma.CustomerWhereInput = {
      AND: [
        customerScopeWhere(user),
        query.type ? { type: query.type } : {},
        query.stage ? { stage: query.stage } : {},
        query.platformId ? { platforms: { some: { platformId: query.platformId } } } : {},
        query.q
          ? {
              OR: [
                { displayName: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
                { phone: { contains: query.q } },
                { contacts: { some: { OR: [{ firstName: { contains: query.q, mode: "insensitive" } }, { lastName: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] } } },
              ],
            }
          : {},
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          type: true,
          stage: true,
          displayName: true,
          email: true,
          phone: true,
          city: true,
          country: true,
          updatedAt: true,
          platforms: PLATFORM_REF,
          _count: { select: { opportunities: { where: { status: { in: [...OPEN_STATUSES] } } } } },
        },
      }),
    ]);
    const scope = platformScope(user);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map(({ platforms, _count, updatedAt, ...row }) => ({
        ...row,
        platforms: visiblePlatforms(platforms, scope),
        openOpportunities: _count.opportunities,
        updatedAt: updatedAt.toISOString(),
      })),
    };
  }

  async get(user: AuthUser, id: string): Promise<CustomerDetail> {
    const row = await this.prisma.customer.findFirst({
      where: { id, ...customerScopeWhere(user) },
      include: {
        createdBy: { select: { id: true, name: true } },
        platforms: PLATFORM_REF,
        contacts: { select: CONTACT_SELECT, orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
        activities: { select: ACTIVITY_SELECT, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT },
      },
    });
    if (!row) throw notFound("Customer");
    const { platforms, contacts, activities, createdAt, updatedAt, createdById: _createdById, ...fields } = row;
    return {
      ...fields,
      platforms: visiblePlatforms(platforms, platformScope(user)),
      contacts,
      activities: activities.map(toActivity),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  async create(user: AuthUser, input: z.output<typeof customerInputSchema>): Promise<{ id: string }> {
    const platformIds = await this.access.checkPlatforms(user, input.platformIds);
    if (platformScope(user) && platformIds.length === 0) throw platformRequired();
    await this.rejectDuplicate(input.customer.email);
    return this.prisma.$transaction((tx) => this.createWith(tx, user, input.customer, platformIds));
  }

  /** Creates a customer inside a transaction; also used when a prospect is registered with an opportunity. */
  async createWith(tx: Prisma.TransactionClient, user: AuthUser, fields: CustomerFields, platformIds: string[]): Promise<{ id: string }> {
    const customer = await tx.customer.create({
      data: {
        ...fields,
        displayName: customerDisplayName(fields),
        createdById: user.id,
        platforms: { create: platformIds.map((platformId) => ({ platformId })) },
      },
      select: { id: true },
    });
    await this.activity.record({ customerId: customer.id, type: "CUSTOMER_CREATED", userId: user.id, data: { stage: fields.stage } }, tx);
    return customer;
  }

  /** Throws 409 when another customer already has this email, so the same person is not entered twice. */
  async rejectDuplicate(email: string | null, exceptId?: string, field = "customer.email"): Promise<void> {
    if (!email) return;
    const existing = await this.prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) {
      const body: ApiErrorBody = {
        statusCode: 409,
        message: "A customer with this email already exists. Search for them instead of adding them again.",
        fieldErrors: { [field]: ["duplicate"] },
      };
      throw new ConflictException(body);
    }
  }

  /**
   * Replaces the customer's fields and its platforms. A manager or employee only changes links to their own
   * platforms; links to other platforms are kept as they are.
   */
  async update(user: AuthUser, id: string, input: z.output<typeof customerInputSchema>): Promise<{ id: string }> {
    await this.access.visibleCustomer(user, id);
    const current = await this.prisma.customer.findUniqueOrThrow({
      where: { id },
      include: { platforms: { select: { platformId: true, platform: { select: { name: true } } } } },
    });
    const requested = await this.access.checkPlatforms(user, input.platformIds);
    const scope = platformScope(user);
    const currentIds = current.platforms.map((link) => link.platformId);
    const kept = scope ? currentIds.filter((platformId) => !scope.includes(platformId)) : [];
    if (scope && requested.length === 0) throw platformRequired();
    const next = [...new Set([...kept, ...requested])];
    const added = next.filter((platformId) => !currentIds.includes(platformId));
    const removed = currentIds.filter((platformId) => !next.includes(platformId));
    await this.rejectDuplicate(input.customer.email, id);

    const fields = input.customer;
    const changed = TRACKED_FIELDS.filter((field) => (current[field] ?? null) !== (fields[field] ?? null));
    const names = new Map(
      (await this.prisma.platform.findMany({ where: { id: { in: [...added, ...removed] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { ...fields, displayName: customerDisplayName(fields) } });
      if (removed.length) await tx.customerPlatform.deleteMany({ where: { customerId: id, platformId: { in: removed } } });
      if (added.length) await tx.customerPlatform.createMany({ data: added.map((platformId) => ({ customerId: id, platformId })) });
      if (changed.length) await this.activity.record({ customerId: id, type: "CUSTOMER_UPDATED", userId: user.id, data: { fields: [...changed] } }, tx);
      if (fields.stage !== current.stage) {
        await this.activity.record({ customerId: id, type: "STAGE_CHANGED", userId: user.id, data: { from: current.stage, to: fields.stage } }, tx);
      }
      for (const platformId of added) {
        await this.activity.record({ customerId: id, type: "PLATFORM_LINKED", userId: user.id, data: { platform: names.get(platformId) ?? "" } }, tx);
      }
      for (const platformId of removed) {
        await this.activity.record({ customerId: id, type: "PLATFORM_UNLINKED", userId: user.id, data: { platform: names.get(platformId) ?? "" } }, tx);
      }
    });
    return { id };
  }

  async setStage(user: AuthUser, id: string, stage: CustomerStage): Promise<void> {
    const customer = await this.access.visibleCustomer(user, id);
    if (customer.stage === stage) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { stage } });
      await this.activity.record({ customerId: id, type: "STAGE_CHANGED", userId: user.id, data: { from: customer.stage, to: stage } }, tx);
    });
  }

  /** Deletes the customer with its contacts, opportunities and history. Only when every platform it uses is the account's. */
  async remove(user: AuthUser, id: string): Promise<void> {
    await this.access.visibleCustomer(user, id);
    const scope = platformScope(user);
    if (scope) {
      const outside = await this.prisma.customerPlatform.count({ where: { customerId: id, platformId: { notIn: scope } } });
      if (outside > 0) throw new ForbiddenException("This customer also uses platforms you do not manage. Ask an administrator.");
    }
    await this.prisma.customer.delete({ where: { id } });
  }

  // ---- Contacts ----

  async addContact(user: AuthUser, customerId: string, input: z.output<typeof contactInputSchema>): Promise<Contact> {
    const customer = await this.access.visibleCustomer(user, customerId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await tx.contact.updateMany({ where: { customerId }, data: { isPrimary: false } });
      const contact = await tx.contact.create({ data: { ...input, customerId }, select: CONTACT_SELECT });
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      await this.activity.record({ customerId: customer.id, type: "CONTACT_ADDED", userId: user.id, data: { name } }, tx);
      return contact;
    });
  }

  async updateContact(user: AuthUser, customerId: string, contactId: string, input: z.output<typeof contactInputSchema>): Promise<Contact> {
    await this.findContact(user, customerId, contactId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await tx.contact.updateMany({ where: { customerId, id: { not: contactId } }, data: { isPrimary: false } });
      return tx.contact.update({ where: { id: contactId }, data: input, select: CONTACT_SELECT });
    });
  }

  async removeContact(user: AuthUser, customerId: string, contactId: string): Promise<void> {
    await this.findContact(user, customerId, contactId);
    await this.prisma.contact.delete({ where: { id: contactId } });
  }

  private async findContact(user: AuthUser, customerId: string, contactId: string): Promise<void> {
    await this.access.visibleCustomer(user, customerId);
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, customerId }, select: { id: true } });
    if (!contact) throw notFound("Contact");
  }

  // ---- History ----

  async addNote(user: AuthUser, customerId: string, input: z.output<typeof noteInputSchema>) {
    await this.access.visibleCustomer(user, customerId);
    if (input.opportunityId) {
      const opportunity = await this.prisma.opportunity.findFirst({ where: { id: input.opportunityId, customerId }, select: { id: true } });
      if (!opportunity) throw notFound("Opportunity");
    }
    const { id } = await this.activity.record({
      customerId,
      type: "NOTE",
      userId: user.id,
      body: input.body,
      opportunityId: input.opportunityId,
    });
    return toActivity(await this.prisma.activity.findUniqueOrThrow({ where: { id }, select: ACTIVITY_SELECT }));
  }
}

/** A manager or employee only sees the platforms they work in on each customer. */
function visiblePlatforms(
  links: Array<{ platform: { id: string; name: string; slug: string; color: string } }>,
  scope: string[] | null,
) {
  return links.map((link) => link.platform).filter((platform) => !scope || scope.includes(platform.id));
}

function platformRequired() {
  const body: ApiErrorBody = { statusCode: 400, message: "Choose at least one of your platforms.", fieldErrors: { platformIds: ["required"] } };
  return new BadRequestException(body);
}
