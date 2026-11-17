import { MailAddress, MailSender, OutgoingMail } from "./mail-sender";

// Brevo transactional email: https://developers.brevo.com/reference/sendtransacemail
// POST /v3/smtp/email with an `api-key` header; body { sender, to[], replyTo, subject, htmlContent, textContent, tags,
// attachment[] }. Each attachment is { name, content } with the file base64-encoded; the extension in `name` must be
// one Brevo accepts (pdf, doc and docx are).
// Answers 201 + { messageId } on success. Same integration as KoulandRoute's mail service.
export const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

export interface BrevoConfig {
  apiKey: string;
  /** Must be a sender or domain verified in the Brevo account. */
  from: MailAddress;
}

export class BrevoMailSender extends MailSender {
  constructor(
    private readonly config: BrevoConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async send(mail: OutgoingMail): Promise<void> {
    const response = await this.fetchImpl(BREVO_URL, {
      method: "POST",
      headers: { "api-key": this.config.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: this.config.from,
        to: mail.to,
        ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        tags: [mail.tag],
        ...(mail.attachments?.length
          ? { attachment: mail.attachments.map((file) => ({ name: file.name, content: file.content.toString("base64") })) }
          : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new Error(`Brevo ${response.status} ${body.code ?? ""} ${body.message ?? ""}`.trim());
    }
  }
}
