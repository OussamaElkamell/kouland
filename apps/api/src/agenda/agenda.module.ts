import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { AppointmentsController, TasksController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";
import { ReminderWorker } from "./reminders";

@Module({
  imports: [CustomersModule],
  controllers: [TasksController, AppointmentsController],
  providers: [AgendaService, ReminderWorker],
  exports: [AgendaService],
})
export class AgendaModule {}
