export interface MailAddress {
  email: string;
  name?: string;
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
}

/**
 * Sends one email. Business code depends on this, never on a provider, so the provider can change without
 * touching it. Implementations throw when the email could not be handed over to the provider.
 */
export abstract class MailSender {
  abstract send(mail: OutgoingMail): Promise<void>;
}
