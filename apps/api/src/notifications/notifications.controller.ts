import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import type { NotificationList } from "@kouland/contracts";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm } from "../auth/crm.guard";
import { NotificationsService } from "./notifications.service";

/** The signed-in person's own notifications. */
@Controller("notifications")
@Crm()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<NotificationList> {
    return this.notifications.list(user.id);
  }

  @Post("read-all")
  @HttpCode(204)
  readAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markRead(user.id);
  }

  @Post(":id/read")
  @HttpCode(204)
  read(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
}
