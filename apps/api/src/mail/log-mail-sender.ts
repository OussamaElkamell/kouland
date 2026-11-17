import { Logger } from "@nestjs/common";
import { MailSender, OutgoingMail } from "./mail-sender";

/** Used when no provider is configured (local development): the email is only written to the API log. */
export class LogMailSender extends MailSender {
  private readonly logger = new Logger("Mail");

  async send(mail: OutgoingMail): Promise<void> {
    const to = mail.to.map((address) => address.email).join(", ");
    const files = mail.attachments?.length ? ` (+${mail.attachments.map((file) => file.name).join(", ")})` : "";
    this.logger.log(`[mail not sent: set BREVO_API_KEY] ${mail.tag} to ${to}: ${mail.subject}${files}`);
  }
}
