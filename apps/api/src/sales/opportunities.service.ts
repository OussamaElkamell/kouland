import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type OpportunityStatus as DbStatus } from "@prisma/client";
import {
  CLOSED_STATUSES,
  OPEN_STATUSES,
  type ApiErrorBody,
  type OpportunityDetail,
  type OpportunityStatus,
  type OpportunitySummary,
  type Page,
  type Proposal,
  createOpportunitySchema,
  opportunityListQuerySchema,
  proposalInputSchema,
  updateOpportunitySchema,
} from "@kouland/contracts";
import type { z } from "zod";
import { platformScope, type AuthUser } from "../auth/auth-user";
import { notFound } from "../common/prisma-errors";
import { ActivityService } from "../customers/activity.service";
import { CustomerAccess } from "../customers/customer-access";
import { CustomersService } from "../customers/customers.service";
import { PrismaService } from "../prisma/prisma.service";

const SUMMARY_SELECT = {
  id: true,
  title: true,
  status: true,
  source: true,
  estimatedValue: true,
  currency: true,
  expectedCloseDate: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, displayName: true, stage: true } },
  platform: { select: { id: true, name: true, slug: true, color: true } },
  owner: { select: { id: true, name: true } },
  _count: { select: { proposals: true } },
} satisfies Prisma.OpportunitySelect;

const PROPOSAL_SELECT = {
  id: true,
  title: true,
  amount: true,
  currency: true,
  status: true,
  validUntil: true,
  details: true,
  sentAt: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ProposalSelect;

type SummaryRow = Prisma.OpportunityGetPayload<{ select: typeof SUMMARY_SELECT }>;
type ProposalRow = Prisma.ProposalGetPayload<{ select: typeof PROPOSAL_SELECT }>;

const money = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());
const iso = (value: Date | null) => value?.toISOString() ?? null;

function toSummary({ customer, _count, estimatedValue, createdAt, updatedAt, ...row }: SummaryRow): OpportunitySummary {
  return {
    ...row,
    estimatedValue: money(estimatedValue),
    customer: { id: customer.id, name: customer.displayName, stage: customer.stage },
    proposalCount: _count.proposals,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function toProposal({ amount, sentAt, respondedAt, createdAt, updatedAt, ...row }: ProposalRow): Proposal {
  return {
    ...row,
    amount: amount.toNumber(),
    sentAt: iso(sentAt),
    respondedAt: iso(respondedAt),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** WON and LOST close the opportunity; moving back to an open status reopens it. */
const closedAtFor = (status: OpportunityStatus, previous: Date | null) =>
  CLOSED_STATUSES.includes(status) ? (previous ?? new Date()) : null;

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CustomerAccess,
    private readonly customers: CustomersService,
    private readonly activity: ActivityService,
  ) {}

  /** Opportunities of the account's platforms. */
  private scopeWhere(user: AuthUser): Prisma.OpportunityWhereInput {
    const scope = platformScope(user);
    return scope ? { platformId: { in: scope } } : {};
  }

  async list(user: AuthUser, query: z.output<typeof opportunityListQuerySchema>): Promise<Page<OpportunitySummary>> {
    const statusFilter: Prisma.OpportunityWhereInput = query.status
      ? { status: query.status }
      : query.state === "open"
        ? { status: { in: [...OPEN_STATUSES] } }
        : query.state === "closed"
          ? { status: { in: [...CLOSED_STATUSES] } }
          : {};
    const where: Prisma.OpportunityWhereInput = {
      AND: [
        this.scopeWhere(user),
        statusFilter,
        query.platformId ? { platformId: query.platformId } : {},
        query.customerId ? { customerId: query.customerId } : {},
        query.ownerId ? { ownerId: query.ownerId } : {},
        query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { customer: { displayName: { contains: query.q, mode: "insensitive" } } },
              ],
            }
          : {},
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: SUMMARY_SELECT,
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows.map(toSummary) };
  }

  async get(user: AuthUser, id: string): Promise<OpportunityDetail> {
    const row = await this.prisma.opportunity.findFirst({
      where: { id, ...this.scopeWhere(user) },
      select: {
        ...SUMMARY_SELECT,
        request: true,
        lostReason: true,
        closedAt: true,
        proposals: { select: PROPOSAL_SELECT, orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) throw notFound("Opportunity");
    const { request, lostReason, closedAt, proposals, ...summary } = row;
    return { ...toSummary(summary), request, lostReason, closedAt: iso(closedAt), proposals: proposals.map(toProposal) };
  }

  /**
   * Registers an opportunity, for an existing customer or for a new prospect created at the same time. The
   * customer is linked to the opportunity's platform if it was not already, so the platform's section shows it.
   */
  async create(user: AuthUser, input: z.output<typeof createOpportunitySchema>): Promise<{ id: string }> {
    await this.access.checkPlatforms(user, [input.platformId], "platformId");
    const { platformId } = input;
    await this.checkOwner(input.ownerId);
    if (input.customerId) await this.access.visibleCustomer(user, input.customerId);
    if (input.newCustomer) await this.customers.rejectDuplicate(input.newCustomer.email, undefined, "newCustomer.email");
    const platform = await this.prisma.platform.findUniqueOrThrow({ where: { id: platformId }, select: { name: true } });

    return this.prisma.$transaction(async (tx) => {
      const customerId = input.customerId ?? (await this.customers.createWith(tx, user, input.newCustomer!, [platformId])).id;
      const linked = await tx.customerPlatform.findUnique({ where: { customerId_platformId: { customerId, platformId } } });
      if (!linked) {
        await tx.customerPlatform.create({ data: { customerId, platformId } });
        await this.activity.record({ customerId, type: "PLATFORM_LINKED", userId: user.id, data: { platform: platform.name } }, tx);
      }
      const opportunity = await tx.opportunity.create({
        data: {
          title: input.title,
          customerId,
          platformId,
          status: input.status,
          source: input.source,
          request: input.request,
          estimatedValue: input.estimatedValue,
          currency: input.currency,
          expectedCloseDate: input.expectedCloseDate,
          ownerId: input.ownerId,
          lostReason: input.status === "LOST" ? input.lostReason : null,
          closedAt: closedAtFor(input.status, null),
        },
        select: { id: true },
      });
      await this.activity.record(
        { customerId, opportunityId: opportunity.id, type: "OPPORTUNITY_CREATED", userId: user.id, data: { title: input.title, status: input.status } },
        tx,
      );
      if (input.status === "WON") await this.markCustomer(tx, user, customerId);
      return opportunity;
    });
  }

  async update(user: AuthUser, id: string, input: z.output<typeof updateOpportunitySchema>): Promise<{ id: string }> {
    const current = await this.visible(user, id);
    if (input.platformId !== current.platformId) await this.access.checkPlatforms(user, [input.platformId], "platformId");
    await this.checkOwner(input.ownerId);
    await this.prisma.$transaction(async (tx) => {
      if (input.platformId !== current.platformId) {
        await tx.customerPlatform.upsert({
          where: { customerId_platformId: { customerId: current.customerId, platformId: input.platformId } },
          create: { customerId: current.customerId, platformId: input.platformId },
          update: {},
        });
      }
      await tx.opportunity.update({
        where: { id },
        data: {
          ...input,
          lostReason: input.status === "LOST" ? input.lostReason : null,
          closedAt: closedAtFor(input.status, current.closedAt),
        },
      });
      await this.recordStatus(tx, user, current, input.status);
    });
    return { id };
  }

  async setStatus(user: AuthUser, id: string, status: OpportunityStatus, lostReason?: string | null): Promise<void> {
    const current = await this.visible(user, id);
    if (current.status === status && lostReason === undefined) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id },
        data: {
          status,
          closedAt: closedAtFor(status, current.closedAt),
          lostReason: status === "LOST" ? (lostReason === undefined ? current.lostReason : lostReason) : null,
        },
      });
      await this.recordStatus(tx, user, current, status);
    });
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.visible(user, id);
    await this.prisma.opportunity.delete({ where: { id } });
  }

  // ---- Proposals ----

  async addProposal(user: AuthUser, opportunityId: string, input: z.output<typeof proposalInputSchema>): Promise<Proposal> {
    const opportunity = await this.visible(user, opportunityId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.proposal.create({
        data: { ...input, ...this.proposalDates(input.status, null, null), opportunityId, createdById: user.id },
        select: PROPOSAL_SELECT,
      });
      await this.activity.record(
        {
          customerId: opportunity.customerId,
          opportunityId,
          type: "PROPOSAL_CREATED",
          userId: user.id,
          data: { title: row.title, amount: row.amount.toNumber(), currency: row.currency, status: row.status },
        },
        tx,
      );
      return toProposal(row);
    });
  }

  async updateProposal(user: AuthUser, proposalId: string, input: z.output<typeof proposalInputSchema>): Promise<Proposal> {
    const { proposal, opportunity } = await this.visibleProposal(user, proposalId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.proposal.update({
        where: { id: proposalId },
        data: { ...input, ...this.proposalDates(input.status, proposal.sentAt, proposal.respondedAt) },
        select: PROPOSAL_SELECT,
      });
      if (proposal.status !== input.status) {
        await this.activity.record(
          {
            customerId: opportunity.customerId,
            opportunityId: opportunity.id,
            type: "PROPOSAL_STATUS",
            userId: user.id,
            data: { title: row.title, from: proposal.status, to: input.status },
          },
          tx,
        );
      }
      return toProposal(row);
    });
  }

  async removeProposal(user: AuthUser, proposalId: string): Promise<void> {
    await this.visibleProposal(user, proposalId);
    await this.prisma.proposal.delete({ where: { id: proposalId } });
  }

  // ---- Helpers ----

  private async visible(user: AuthUser, id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, ...this.scopeWhere(user) },
      select: { id: true, title: true, status: true, customerId: true, platformId: true, closedAt: true, lostReason: true },
    });
    if (!opportunity) throw notFound("Opportunity");
    return opportunity;
  }

  private async visibleProposal(user: AuthUser, proposalId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true, sentAt: true, respondedAt: true, opportunityId: true },
    });
    if (!proposal) throw notFound("Proposal");
    const opportunity = await this.visible(user, proposal.opportunityId).catch(() => {
      throw notFound("Proposal");
    });
    return { proposal, opportunity };
  }

  /** sentAt is set the first time a proposal is sent; respondedAt when it is accepted or rejected. */
  private proposalDates(status: string, sentAt: Date | null, respondedAt: Date | null) {
    const now = new Date();
    return {
      sentAt: status === "DRAFT" ? null : (sentAt ?? now),
      respondedAt: status === "ACCEPTED" || status === "REJECTED" ? (respondedAt ?? now) : null,
    };
  }

  private async recordStatus(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    current: { id: string; title: string; status: DbStatus; customerId: string },
    status: OpportunityStatus,
  ): Promise<void> {
    if (current.status === status) return;
    await this.activity.record(
      {
        customerId: current.customerId,
        opportunityId: current.id,
        type: "OPPORTUNITY_STATUS",
        userId: user.id,
        data: { title: current.title, from: current.status, to: status },
      },
      tx,
    );
    if (status === "WON") await this.markCustomer(tx, user, current.customerId);
  }

  /** A won opportunity turns its prospect into a customer. */
  private async markCustomer(tx: Prisma.TransactionClient, user: AuthUser, customerId: string): Promise<void> {
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { stage: true } });
    if (customer.stage === "CUSTOMER") return;
    await tx.customer.update({ where: { id: customerId }, data: { stage: "CUSTOMER" } });
    await this.activity.record({ customerId, type: "STAGE_CHANGED", userId: user.id, data: { from: "PROSPECT", to: "CUSTOMER" } }, tx);
  }

  /** The owner must be an active account that can work on sales. */
  private async checkOwner(ownerId: string | null): Promise<void> {
    if (!ownerId) return;
    const owner = await this.prisma.user.findFirst({
      where: {
        id: ownerId,
        isActive: true,
        OR: [{ role: "ADMIN" }, { permissions: { some: { area: "SALES", level: { in: ["EDIT", "MANAGE"] } } } }],
      },
      select: { id: true },
    });
    if (!owner) {
      const body: ApiErrorBody = { statusCode: 400, message: "This person cannot be given sales.", fieldErrors: { ownerId: ["invalid"] } };
      throw new BadRequestException(body);
    }
  }
}
