import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  createTicketSchema,
  supportRequestSchema,
  ticketCommentSchema,
  ticketListQuerySchema,
  updateTicketSchema,
  type Page,
  type SupportReceipt,
  type TicketDetail,
  type TicketSummary,
  type TicketUpdate,
} from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { TicketsService } from "./tickets.service";

@Controller("tickets")
@Crm()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireAccess("TICKETS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(ticketListQuerySchema)) query: z.output<typeof ticketListQuerySchema>): Promise<Page<TicketSummary>> {
    return this.tickets.list(user, query);
  }

  @Get(":id")
  @RequireAccess("TICKETS", "VIEW")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<TicketDetail> {
    return this.tickets.get(user, id);
  }

  @Post()
  @RequireAccess("TICKETS", "EDIT")
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createTicketSchema)) body: z.output<typeof createTicketSchema>): Promise<{ id: string }> {
    return this.tickets.create(user, body);
  }

  @Patch(":id")
  @RequireAccess("TICKETS", "EDIT")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) body: z.output<typeof updateTicketSchema>,
  ): Promise<{ id: string }> {
    return this.tickets.update(user, id, body);
  }

  /** A comment in the ticket's progress. Anyone who can see the ticket can write one. */
  @Post(":id/comments")
  @RequireAccess("TICKETS", "VIEW")
  comment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body(new ZodValidationPipe(ticketCommentSchema)) body: { body: string }): Promise<TicketUpdate> {
    return this.tickets.comment(user, id, body.body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("TICKETS", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.tickets.remove(user, id);
  }
}

/** Public: the "Report an issue" form on kouland.com. */
@Controller("support")
export class SupportController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly prisma: PrismaService,
  ) {}

  /** The services a visitor can pick (active platforms; names only). */
  @Get("platforms")
  platforms(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.platform.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  }

  /** Limited to 5 requests a minute per IP address. */
  @Post("tickets")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  create(@Body(new ZodValidationPipe(supportRequestSchema)) body: z.output<typeof supportRequestSchema>): Promise<SupportReceipt> {
    return this.tickets.createFromWebsite(body);
  }
}
