import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createUserSchema, updateUserSchema, type InvitedUser, type LinkReceipt, type Ref, type User } from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { AdminOnly, Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller("users")
@Crm()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @AdminOnly()
  list(): Promise<User[]> {
    return this.users.list();
  }

  /** Names of the people an opportunity can be assigned to. */
  @Get("assignable")
  @RequireAccess("SALES", "VIEW")
  assignable(): Promise<Ref[]> {
    return this.users.assignable();
  }

  @Post()
  @AdminOnly()
  create(@CurrentUser() actor: AuthUser, @Body(new ZodValidationPipe(createUserSchema)) body: z.output<typeof createUserSchema>): Promise<InvitedUser> {
    return this.users.create(actor, body);
  }

  /** Change role, access, platforms, or deactivate (`isActive: false`, which also signs the account out). */
  @Patch(":id")
  @AdminOnly()
  update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: z.output<typeof updateUserSchema>,
  ): Promise<User> {
    return this.users.update(actor, id, body);
  }

  /** Emails a new invitation (never signed in yet) or a link to choose a new password. */
  @Post(":id/link")
  @HttpCode(200)
  @AdminOnly()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  sendLink(@CurrentUser() actor: AuthUser, @Param("id") id: string): Promise<LinkReceipt> {
    return this.users.sendLink(actor, id);
  }
}
