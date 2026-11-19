import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CrmGuard } from "./crm.guard";
import { SessionService } from "./session.service";

/** Global so every CRM module can use @Crm() without importing this module. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, CrmGuard],
  exports: [SessionService, CrmGuard],
})
export class AuthModule {}
