import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  createOpportunitySchema,
  opportunityListQuerySchema,
  opportunityStatusInputSchema,
  proposalInputSchema,
  updateOpportunitySchema,
  type OpportunityDetail,
  type OpportunitySummary,
  type Page,
  type Proposal,
} from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OpportunitiesService } from "./opportunities.service";

@Controller("opportunities")
@Crm()
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  @RequireAccess("SALES", "VIEW")
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(opportunityListQuerySchema)) query: z.output<typeof opportunityListQuerySchema>,
  ): Promise<Page<OpportunitySummary>> {
    return this.opportunities.list(user, query);
  }

  @Get(":id")
  @RequireAccess("SALES", "VIEW")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<OpportunityDetail> {
    return this.opportunities.get(user, id);
  }

  /** A new opportunity, for an existing customer or a new prospect registered at the same time. */
  @Post()
  @RequireAccess("SALES", "EDIT")
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createOpportunitySchema)) body: z.output<typeof createOpportunitySchema>,
  ): Promise<{ id: string }> {
    return this.opportunities.create(user, body);
  }

  @Put(":id")
  @RequireAccess("SALES", "EDIT")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOpportunitySchema)) body: z.output<typeof updateOpportunitySchema>,
  ): Promise<{ id: string }> {
    return this.opportunities.update(user, id, body);
  }

  @Patch(":id/status")
  @HttpCode(204)
  @RequireAccess("SALES", "EDIT")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(opportunityStatusInputSchema)) body: z.output<typeof opportunityStatusInputSchema>,
  ): Promise<void> {
    return this.opportunities.setStatus(user, id, body.status, body.lostReason);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("SALES", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.opportunities.remove(user, id);
  }

  @Post(":id/proposals")
  @RequireAccess("SALES", "EDIT")
  addProposal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(proposalInputSchema)) body: z.output<typeof proposalInputSchema>,
  ): Promise<Proposal> {
    return this.opportunities.addProposal(user, id, body);
  }
}

@Controller("proposals")
@Crm()
export class ProposalsController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Put(":id")
  @RequireAccess("SALES", "EDIT")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(proposalInputSchema)) body: z.output<typeof proposalInputSchema>,
  ): Promise<Proposal> {
    return this.opportunities.updateProposal(user, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("SALES", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.opportunities.removeProposal(user, id);
  }
}
