import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MailModule } from "../mail/mail.module";
import { CareersController } from "./careers.controller";
import { CareersService } from "./careers.service";

@Module({
  imports: [ConfigModule, MailModule],
  controllers: [CareersController],
  providers: [CareersService],
})
export class CareersModule {}
