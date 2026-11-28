import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { createPlatformSchema, updatePlatformSchema, type Platform } from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { AdminOnly, Crm } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PlatformsService } from "./platforms.service";

@Controller("platforms")
@Crm()
export class PlatformsController {
  constructor(private readonly platforms: PlatformsService) {}

  /** Any signed-in account: the platforms it may work in. `?all=1` adds inactive ones for administrators. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("all") all?: string): Promise<Platform[]> {
    return this.platforms.list(user, all === "1" || all === "true");
  }

  @Post()
  @AdminOnly()
  create(@Body(new ZodValidationPipe(createPlatformSchema)) body: z.output<typeof createPlatformSchema>): Promise<Platform> {
    return this.platforms.create(body);
  }

  /** Edit, deactivate (`isActive: false`) or reactivate. Platforms are never deleted. */
  @Patch(":id")
  @AdminOnly()
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePlatformSchema)) body: z.output<typeof updatePlatformSchema>,
  ): Promise<Platform> {
    return this.platforms.update(id, body);
  }
}
