import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ContactMessageReceipt, CreateContactMessage } from "@kouland/contracts";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { buildContactEmail } from "./contact-email";

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailSender,
    private readonly config: ConfigService,
  ) {}

  /**
   * Stores a website contact message, then emails it to the company inbox (CONTACT_INBOX_EMAIL) with the
   * visitor as reply-to. The message is saved first, so an email failure never loses it or fails the request.
   */
  async create(input: CreateContactMessage): Promise<ContactMessageReceipt> {
    const saved = await this.prisma.contactMessage.create({
      data: input,
      select: { id: true, createdAt: true },
    });
    await this.notifyInbox(saved.id, input, saved.createdAt);
    return { id: saved.id, createdAt: saved.createdAt.toISOString() };
  }

  private async notifyInbox(id: string, input: CreateContactMessage, receivedAt: Date): Promise<void> {
    const inbox = this.config.get<string>("CONTACT_INBOX_EMAIL");
    if (!inbox) {
      this.logger.warn(`Contact message ${id} saved but not emailed: CONTACT_INBOX_EMAIL is not set.`);
      return;
    }
    try {
      const email = buildContactEmail(input, receivedAt);
      await this.mail.send({
        to: [{ email: inbox, name: "Kouland Technology" }],
        replyTo: { email: input.email, name: input.name },
        subject: email.subject,
        html: email.html,
        text: email.text,
        tag: "contact-message",
      });
    } catch (error) {
      this.logger.error(`Contact message ${id} saved but the email failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
