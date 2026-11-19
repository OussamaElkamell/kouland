import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  contactInputSchema,
  customerInputSchema,
  customerListQuerySchema,
  customerStageInputSchema,
  noteInputSchema,
  type Activity,
  type Contact,
  type CustomerDetail,
  type CustomerSummary,
  type Page,
} from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CustomersService } from "./customers.service";

@Controller("customers")
@Crm()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequireAccess("CUSTOMERS", "VIEW")
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(customerListQuerySchema)) query: z.output<typeof customerListQuerySchema>,
  ): Promise<Page<CustomerSummary>> {
    return this.customers.list(user, query);
  }

  @Get(":id")
  @RequireAccess("CUSTOMERS", "VIEW")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<CustomerDetail> {
    return this.customers.get(user, id);
  }

  @Post()
  @RequireAccess("CUSTOMERS", "EDIT")
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(customerInputSchema)) body: z.output<typeof customerInputSchema>,
  ): Promise<{ id: string }> {
    return this.customers.create(user, body);
  }

  @Put(":id")
  @RequireAccess("CUSTOMERS", "EDIT")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customerInputSchema)) body: z.output<typeof customerInputSchema>,
  ): Promise<{ id: string }> {
    return this.customers.update(user, id, body);
  }

  @Patch(":id/stage")
  @HttpCode(204)
  @RequireAccess("CUSTOMERS", "EDIT")
  setStage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customerStageInputSchema)) body: z.output<typeof customerStageInputSchema>,
  ): Promise<void> {
    return this.customers.setStage(user, id, body.stage);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireAccess("CUSTOMERS", "MANAGE")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.customers.remove(user, id);
  }

  @Post(":id/contacts")
  @RequireAccess("CUSTOMERS", "EDIT")
  addContact(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contactInputSchema)) body: z.output<typeof contactInputSchema>,
  ): Promise<Contact> {
    return this.customers.addContact(user, id, body);
  }

  @Put(":id/contacts/:contactId")
  @RequireAccess("CUSTOMERS", "EDIT")
  updateContact(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body(new ZodValidationPipe(contactInputSchema)) body: z.output<typeof contactInputSchema>,
  ): Promise<Contact> {
    return this.customers.updateContact(user, id, contactId, body);
  }

  @Delete(":id/contacts/:contactId")
  @HttpCode(204)
  @RequireAccess("CUSTOMERS", "EDIT")
  removeContact(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("contactId") contactId: string): Promise<void> {
    return this.customers.removeContact(user, id, contactId);
  }

  /** A note in the customer's history. Anyone who can see the customer can write one. */
  @Post(":id/notes")
  @RequireAccess("CUSTOMERS", "VIEW")
  addNote(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(noteInputSchema)) body: z.output<typeof noteInputSchema>,
  ): Promise<Activity> {
    return this.customers.addNote(user, id, body);
  }
}
