import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BrevoMailSender } from "./brevo-mail-sender";
import { LogMailSender } from "./log-mail-sender";
import { MailSender } from "./mail-sender";

/**
 * Provides the MailSender. With BREVO_API_KEY set, emails go through Brevo; without it (local development)
 * they are only logged. To change provider, add another MailSender and choose it here.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailSender => {
        const apiKey = config.get<string>("BREVO_API_KEY");
        if (!apiKey) {
          if (config.get<string>("NODE_ENV") === "production") {
            new Logger("Mail").warn("BREVO_API_KEY is not set: emails will not be sent.");
          }
          return new LogMailSender();
        }
        return new BrevoMailSender({
          apiKey,
          from: {
            email: config.get<string>("MAIL_FROM_EMAIL") ?? "noreply@kouland.com",
            name: config.get<string>("MAIL_FROM_NAME") ?? "Kouland Technology",
          },
        });
      },
    },
  ],
  exports: [MailSender],
})
export class MailModule {}
