import { Global, Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/** Global: tickets, tasks, sales and the reminder worker all send notifications. */
@Global()
@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
