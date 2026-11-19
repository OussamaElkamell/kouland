import { Module } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { CustomerAccess } from "./customer-access";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerAccess, ActivityService],
  exports: [CustomersService, CustomerAccess, ActivityService],
})
export class CustomersModule {}
