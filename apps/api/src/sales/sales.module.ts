import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { OpportunitiesController, ProposalsController } from "./opportunities.controller";
import { OpportunitiesService } from "./opportunities.service";

@Module({
  imports: [CustomersModule],
  controllers: [OpportunitiesController, ProposalsController],
  providers: [OpportunitiesService],
})
export class SalesModule {}
