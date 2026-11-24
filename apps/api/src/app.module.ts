import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AgendaModule } from "./agenda/agenda.module";
import { AuthModule } from "./auth/auth.module";
import { CareersModule } from "./careers/careers.module";
import { ContactModule } from "./contact/contact.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard";
import { HealthController } from "./health/health.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlatformsModule } from "./platforms/platforms.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SalesModule } from "./sales/sales.module";
import { SyncModule } from "./sync/sync.module";
import { EmailModule } from "./email/email.module";
import { PhoneModule } from "./phone/phone.module";
import { TicketsModule } from "./tickets/tickets.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default limit for every route, per IP address. Generous because a whole office behind one connection shares
    // it while using the CRM; public forms and sign-in set much stricter ones with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    PrismaModule,
    ContactModule,
    CareersModule,
    // CRM
    AuthModule,
    UsersModule,
    PlatformsModule,
    CustomersModule,
    SalesModule,
    NotificationsModule,
    TicketsModule,
    AgendaModule,
    DashboardModule,
    // Milestone 4
    SyncModule,
    EmailModule,
    PhoneModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
