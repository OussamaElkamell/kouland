import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { DepartmentsModule } from "./departments";
import { SupportController, TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [CustomersModule, DepartmentsModule],
  controllers: [TicketsController, SupportController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
