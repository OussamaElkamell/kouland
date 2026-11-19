import { z } from "zod";
import {
  currencySchema,
  ERROR_CODES,
  idSchema,
  optionalAmount,
  optionalDate,
  optionalText,
  pageQuery,
  platformRefSchema,
  refSchema,
  text,
  amount,
} from "./common";
import { customerFieldsSchema, customerStageSchema } from "./customers";

/** The sales pipeline, in order. WON and LOST close the opportunity. */
export const OPPORTUNITY_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"] as const;
export const opportunityStatusSchema = z.enum(OPPORTUNITY_STATUSES);
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export const CLOSED_STATUSES: readonly OpportunityStatus[] = ["WON", "LOST"];
export const OPEN_STATUSES = OPPORTUNITY_STATUSES.filter((status) => !CLOSED_STATUSES.includes(status));

export const OPPORTUNITY_SOURCES = ["WEBSITE", "PHONE", "EMAIL", "REFERRAL", "PLATFORM", "WALK_IN", "OTHER"] as const;
export const opportunitySourceSchema = z.enum(OPPORTUNITY_SOURCES);
export type OpportunitySource = z.infer<typeof opportunitySourceSchema>;

export const PROPOSAL_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export const proposalStatusSchema = z.enum(PROPOSAL_STATUSES);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

const opportunityFields = {
  title: text(160),
  platformId: idSchema,
  status: opportunityStatusSchema.default("NEW"),
  source: opportunitySourceSchema.default("OTHER"),
  request: optionalText(5000),
  estimatedValue: optionalAmount,
  currency: currencySchema,
  expectedCloseDate: optionalDate,
  ownerId: idSchema.nullish().transform((value) => value ?? null),
  lostReason: optionalText(1000),
};

/**
 * POST /opportunities. Either for an existing customer (`customerId`), or registering a new prospect at the
 * same time (`newCustomer`); the prospect is linked to the opportunity's platform.
 */
export const createOpportunitySchema = z
  .object({
    ...opportunityFields,
    customerId: idSchema.optional(),
    newCustomer: customerFieldsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.customerId === !value.newCustomer) ctx.addIssue({ code: "custom", path: ["customerId"], message: ERROR_CODES.required });
  });
export type CreateOpportunityInput = z.input<typeof createOpportunitySchema>;

/** PUT /opportunities/:id (the whole record is sent; the customer cannot change). */
export const updateOpportunitySchema = z.object(opportunityFields);
export type UpdateOpportunityInput = z.input<typeof updateOpportunitySchema>;

/** PATCH /opportunities/:id/status: move along the pipeline. */
export const opportunityStatusInputSchema = z.object({
  status: opportunityStatusSchema,
  lostReason: optionalText(1000).optional(),
});
export type OpportunityStatusInput = z.input<typeof opportunityStatusInputSchema>;

/** GET /opportunities */
export const opportunityListQuerySchema = z.object({
  ...pageQuery,
  status: opportunityStatusSchema.optional(),
  /** "open" or "closed" groups of statuses. */
  state: z.enum(["open", "closed"]).optional(),
  platformId: idSchema.optional(),
  customerId: idSchema.optional(),
  ownerId: idSchema.optional(),
});
export type OpportunityListQuery = z.input<typeof opportunityListQuerySchema>;

export const opportunitySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: opportunityStatusSchema,
  source: opportunitySourceSchema,
  estimatedValue: z.number().nullable(),
  currency: z.string(),
  expectedCloseDate: z.string().nullable(),
  customer: z.object({ id: z.string(), name: z.string(), stage: customerStageSchema }),
  platform: platformRefSchema,
  owner: refSchema.nullable(),
  proposalCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OpportunitySummary = z.infer<typeof opportunitySummarySchema>;

// ---- Proposals ----

/** POST /opportunities/:id/proposals and PUT /proposals/:id */
export const proposalInputSchema = z.object({
  title: text(160),
  amount,
  currency: currencySchema,
  status: proposalStatusSchema.default("DRAFT"),
  validUntil: optionalDate,
  details: optionalText(10000),
});
export type ProposalInput = z.input<typeof proposalInputSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: proposalStatusSchema,
  validUntil: z.string().nullable(),
  details: z.string().nullable(),
  sentAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  createdBy: refSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Proposal = z.infer<typeof proposalSchema>;

export const opportunityDetailSchema = opportunitySummarySchema.extend({
  request: z.string().nullable(),
  lostReason: z.string().nullable(),
  closedAt: z.string().nullable(),
  proposals: z.array(proposalSchema),
});
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;
