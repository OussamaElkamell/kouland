import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CvMimeType, JobApplication, JobApplicationReceipt } from "@kouland/contracts";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { buildApplicationEmail } from "./application-email";
import { cvAttachmentName, type UploadedCv } from "./cv-file";

@Injectable()
export class CareersService {
  private readonly logger = new Logger(CareersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailSender,
    private readonly config: ConfigService,
  ) {}

  /**
   * Stores a job application with its CV, then emails it to the hiring inbox (CAREERS_INBOX_EMAIL, or
   * CONTACT_INBOX_EMAIL when not set) with the CV attached and the applicant as reply-to. The application is
   * saved first, so an email failure never loses it or fails the request.
   */
  async apply(application: JobApplication, cv: UploadedCv, cvMimeType: CvMimeType, locale: "en" | "fr" | "es"): Promise<JobApplicationReceipt> {
    const { consent: _consent, ...fields } = application;
    const saved = await this.prisma.jobApplication.create({
      data: {
        ...fields,
        consentAt: new Date(),
        locale,
        cvFileName: cv.originalname.slice(0, 200),
        cvMimeType,
        cvSize: cv.size,
        cvData: Uint8Array.from(cv.buffer),
      },
      select: { id: true, createdAt: true },
    });
    await this.notifyInbox(saved.id, application, cv, cvMimeType, locale, saved.createdAt);
    return { id: saved.id, createdAt: saved.createdAt.toISOString() };
  }

  private async notifyInbox(
    id: string,
    application: JobApplication,
    cv: UploadedCv,
    cvMimeType: CvMimeType,
    locale: "en" | "fr" | "es",
    receivedAt: Date,
  ): Promise<void> {
    const inbox = this.config.get<string>("CAREERS_INBOX_EMAIL") || this.config.get<string>("CONTACT_INBOX_EMAIL");
    if (!inbox) {
      this.logger.warn(`Job application ${id} saved but not emailed: set CAREERS_INBOX_EMAIL or CONTACT_INBOX_EMAIL.`);
      return;
    }
    try {
      const email = buildApplicationEmail(application, locale, receivedAt);
      await this.mail.send({
        to: [{ email: inbox, name: "Kouland Technology" }],
        replyTo: { email: application.email, name: application.fullName },
        subject: email.subject,
        html: email.html,
        text: email.text,
        tag: "job-application",
        attachments: [{ name: cvAttachmentName(application.fullName, cvMimeType), content: cv.buffer }],
      });
    } catch (error) {
      this.logger.error(`Job application ${id} saved but the email failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
