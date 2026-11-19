import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { createUserSchema, resetPasswordSchema, updateUserSchema, type Ref, type User } from "@kouland/contracts";
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
  create(@Body(new ZodValidationPipe(createUserSchema)) body: z.output<typeof createUserSchema>): Promise<User> {
    return this.users.create(body);
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

  @Post(":id/password")
  @HttpCode(204)
  @AdminOnly()
  resetPassword(@Param("id") id: string, @Body(new ZodValidationPipe(resetPasswordSchema)) body: { password: string }): Promise<void> {
    return this.users.resetPassword(id, body.password);
  }
}
