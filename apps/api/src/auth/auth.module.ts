import { Global, Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CrmGuard } from "./crm.guard";
import { LinkService } from "./link.service";
import { SessionService } from "./session.service";

/** Global so every CRM module can use @Crm() and send invitation links without importing this module. */
@Global()
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, CrmGuard, LinkService],
  exports: [SessionService, CrmGuard, LinkService],
})
export class AuthModule {}
