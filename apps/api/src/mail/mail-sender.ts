export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  /** File name shown to the recipient, with its extension (e.g. "cv.pdf"). */
  name: string;
  content: Buffer;
}

export interface OutgoingMail {
  to: MailAddress[];
  /** Where replies go, e.g. the visitor who filled in the contact form. */
  replyTo?: MailAddress;
  subject: string;
  html: string;
  text: string;
  /** Short label for the provider's logs and statistics, e.g. "contact-message". */
  tag: string;
  attachments?: MailAttachment[];
}

/**
 * Sends one email. Business code depends on this, never on a provider, so the provider can change without
 * touching it. Implementations throw when the email could not be handed over to the provider.
 */
export abstract class MailSender {
  abstract send(mail: OutgoingMail): Promise<void>;
}
