import { BadGatewayException } from "@nestjs/common";
import type { EmailAddress, EmailMessage, EmailProvider, EmailSummary } from "@kouland/contracts";

/**
 * Google Workspace (Gmail API) and Microsoft 365 (Microsoft Graph) mailboxes, called with fetch.
 *   Gmail: https://developers.google.com/workspace/gmail/api/reference/rest
 *   Graph: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 *   OAuth: https://developers.google.com/identity/protocols/oauth2/web-server and
 *          https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */

export interface Tokens {
  accessToken: string;
  /** Google only sends a new one on the first consent; the old one is kept otherwise. */
  refreshToken: string | null;
  expiresAt: Date;
}

export interface OutgoingEmail {
  from: string;
  to: string;
  cc: string[];
  subject: string;
  body: string;
  /** Replying to this message (the mailbox's own id for it). */
  replyTo?: { id: string; threadId: string | null; messageIdHeader: string | null; references: string | null };
}

/** Message as read for a reply: the headers that keep the conversation together. */
export type FullMessage = EmailMessage & { messageIdHeader: string | null; references: string | null };

export interface MailProvider {
  readonly id: EmailProvider;
  configured(): boolean;
  authorizeUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<Tokens & { email: string }>;
  refresh(refreshToken: string): Promise<Tokens>;
  search(accessToken: string, mailbox: string, addresses: string[], limit: number): Promise<EmailSummary[]>;
  get(accessToken: string, mailbox: string, id: string): Promise<FullMessage>;
  send(accessToken: string, email: OutgoingEmail): Promise<void>;
}

async function call<T>(url: string, init: RequestInit, what: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new BadGatewayException(`${what}: could not reach the mail provider (${error instanceof Error ? error.message : String(error)}).`);
  }
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || /invalid_grant/.test(text)) throw new MailboxAuthError(what);
    throw new BadGatewayException(`${what} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The mailbox refused the stored sign-in (revoked or expired): the person must connect it again. */
export class MailboxAuthError extends Error {
  constructor(what: string) {
    super(`${what}: the mailbox sign-in is no longer valid.`);
  }
}

const form = (values: Record<string, string>) => new URLSearchParams(values).toString();
const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

/** "Ann Lee <ann@x.com>, bob@y.com" → addresses. */
export function parseAddressList(value: string | null | undefined): EmailAddress[] {
  if (!value) return [];
  const parts = value.match(/(?:[^,"]|"[^"]*")+/g) ?? [];
  return parts
    .map((part) => {
      const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(part);
      if (match) return { name: match[1]!.trim() || null, email: match[2]!.trim().toLowerCase() };
      const email = part.trim().toLowerCase();
      return email.includes("@") ? { name: null, email } : null;
    })
    .filter((item): item is EmailAddress => item !== null);
}

/** RFC 2047 for non-ASCII headers. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** The MIME message Gmail sends (base64url of RFC 2822). */
export function buildMime(email: OutgoingEmail): string {
  const lines = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    ...(email.cc.length ? [`Cc: ${email.cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (email.replyTo?.messageIdHeader) {
    lines.push(`In-Reply-To: ${email.replyTo.messageIdHeader}`);
    lines.push(`References: ${[email.replyTo.references, email.replyTo.messageIdHeader].filter(Boolean).join(" ")}`);
  }
  const body = Buffer.from(email.body, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  return Buffer.from(`${lines.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

// ---------------------------------------------------------------------------------------------------------------

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

const header = (headers: GmailHeader[] | undefined, name: string) => headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

function gmailBodies(part: GmailPart | undefined, found: { html: string | null; text: string | null } = { html: null, text: null }) {
  if (!part) return found;
  const data = part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : null;
  if (data && part.mimeType === "text/html" && found.html === null) found.html = data;
  if (data && part.mimeType === "text/plain" && found.text === null) found.text = data;
  for (const child of part.parts ?? []) gmailBodies(child, found);
  return found;
}

export class GoogleMail implements MailProvider {
  readonly id = "GOOGLE" as const;
  private static readonly SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];
  private static readonly API = "https://gmail.googleapis.com/gmail/v1/users/me";

  configured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  authorizeUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GoogleMail.SCOPES.join(" "),
      // offline + consent: Google then returns a refresh token, so the CRM keeps access after an hour.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  private async token(values: Record<string, string>): Promise<Tokens> {
    const data = await call<{ access_token: string; refresh_token?: string; expires_in: number }>(
      "https://oauth2.googleapis.com/token",
      { method: "POST", headers: FORM_HEADERS, body: form({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", ...values }) },
      "Google sign-in",
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async exchange(code: string, redirectUri: string) {
    const tokens = await this.token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
    const profile = await call<{ emailAddress: string }>(`${GoogleMail.API}/profile`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } }, "Gmail profile");
    return { ...tokens, email: profile.emailAddress.toLowerCase() };
  }

  refresh(refreshToken: string) {
    return this.token({ refresh_token: refreshToken, grant_type: "refresh_token" });
  }

  private summary(message: GmailMessage, mailbox: string): EmailSummary {
    const headers = message.payload?.headers;
    const from = parseAddressList(header(headers, "From"))[0] ?? { name: null, email: "" };
    return {
      id: message.id,
      threadId: message.threadId,
      subject: header(headers, "Subject") ?? "",
      from,
      to: parseAddressList(header(headers, "To")),
      date: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
      snippet: message.snippet ?? "",
      outgoing: from.email === mailbox.toLowerCase(),
    };
  }

  async search(accessToken: string, mailbox: string, addresses: string[], limit: number) {
    const auth = { Authorization: `Bearer ${accessToken}` };
    // Gmail search: {a b c} means a OR b OR c.
    const q = `{${addresses.flatMap((a) => [`from:${a}`, `to:${a}`, `cc:${a}`]).join(" ")}}`;
    const list = await call<{ messages?: Array<{ id: string }> }>(`${GoogleMail.API}/messages?${new URLSearchParams({ q, maxResults: String(limit) })}`, { headers: auth }, "Gmail search");
    const metadata = new URLSearchParams({ format: "metadata" });
    for (const name of ["Subject", "From", "To", "Date"]) metadata.append("metadataHeaders", name);
    const messages = await Promise.all(
      (list.messages ?? []).map((m) => call<GmailMessage>(`${GoogleMail.API}/messages/${m.id}?${metadata}`, { headers: auth }, "Gmail message")),
    );
    return messages.map((m) => this.summary(m, mailbox));
  }

  async get(accessToken: string, mailbox: string, id: string): Promise<FullMessage> {
    const message = await call<GmailMessage>(`${GoogleMail.API}/messages/${encodeURIComponent(id)}?format=full`, { headers: { Authorization: `Bearer ${accessToken}` } }, "Gmail message");
    const headers = message.payload?.headers;
    const bodies = gmailBodies(message.payload);
    return {
      ...this.summary(message, mailbox),
      cc: parseAddressList(header(headers, "Cc")),
      html: bodies.html,
      text: bodies.text,
      webLink: `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${message.id}`,
      messageIdHeader: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
      references: header(headers, "References"),
    };
  }

  async send(accessToken: string, email: OutgoingEmail) {
    await call(
      `${GoogleMail.API}/messages/send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: buildMime(email), ...(email.replyTo?.threadId ? { threadId: email.replyTo.threadId } : {}) }),
      },
      "Gmail send",
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------

interface GraphAddress {
  emailAddress?: { name?: string; address?: string };
}
interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview?: string;
  webLink?: string;
  body?: { contentType?: string; content?: string };
  internetMessageId?: string;
}

const graphAddress = (value: GraphAddress | undefined): EmailAddress => ({
  name: value?.emailAddress?.name ?? null,
  email: (value?.emailAddress?.address ?? "").toLowerCase(),
});
const recipients = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));

export class MicrosoftMail implements MailProvider {
  readonly id = "MICROSOFT" as const;
  private static readonly SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.Read", "Mail.Send"];
  private static readonly API = "https://graph.microsoft.com/v1.0/me";
  private static readonly FIELDS = "id,conversationId,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink";

  private tenant() {
    // "organizations": any work or school account (Microsoft 365). A tenant id limits it to the company's own.
    return process.env.MICROSOFT_TENANT_ID || "organizations";
  }

  configured() {
    return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  }

  authorizeUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: MicrosoftMail.SCOPES.join(" "),
      prompt: "select_account",
      state,
    });
    return `https://login.microsoftonline.com/${this.tenant()}/oauth2/v2.0/authorize?${params}`;
  }

  private async token(values: Record<string, string>): Promise<Tokens> {
    const data = await call<{ access_token: string; refresh_token?: string; expires_in: number }>(
      `https://login.microsoftonline.com/${this.tenant()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: FORM_HEADERS,
        body: form({ client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", scope: MicrosoftMail.SCOPES.join(" "), ...values }),
      },
      "Microsoft sign-in",
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async exchange(code: string, redirectUri: string) {
    const tokens = await this.token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
    const me = await call<{ mail?: string; userPrincipalName?: string }>(`${MicrosoftMail.API}?$select=mail,userPrincipalName`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } }, "Microsoft profile");
    return { ...tokens, email: (me.mail || me.userPrincipalName || "").toLowerCase() };
  }

  refresh(refreshToken: string) {
    return this.token({ refresh_token: refreshToken, grant_type: "refresh_token" });
  }

  private summary(message: GraphMessage, mailbox: string): EmailSummary {
    const from = graphAddress(message.from);
    return {
      id: message.id,
      threadId: message.conversationId ?? null,
      subject: message.subject ?? "",
      from,
      to: (message.toRecipients ?? []).map(graphAddress),
      date: message.receivedDateTime ?? message.sentDateTime ?? new Date().toISOString(),
      snippet: message.bodyPreview ?? "",
      outgoing: from.email === mailbox.toLowerCase(),
    };
  }

  async search(accessToken: string, mailbox: string, addresses: string[], limit: number) {
    // KQL "participants:" matches from, to, cc and bcc; results come newest first.
    const search = `"${addresses.map((a) => `participants:${a}`).join(" OR ")}"`;
    const params = new URLSearchParams({ $search: search, $top: String(limit), $select: MicrosoftMail.FIELDS });
    const data = await call<{ value: GraphMessage[] }>(`${MicrosoftMail.API}/messages?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }, "Outlook search");
    return data.value.map((m) => this.summary(m, mailbox));
  }

  async get(accessToken: string, mailbox: string, id: string): Promise<FullMessage> {
    const params = new URLSearchParams({ $select: `${MicrosoftMail.FIELDS},ccRecipients,body,internetMessageId` });
    const m = await call<GraphMessage>(`${MicrosoftMail.API}/messages/${encodeURIComponent(id)}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }, "Outlook message");
    const html = m.body?.contentType?.toLowerCase() === "html" ? (m.body.content ?? null) : null;
    return {
      ...this.summary(m, mailbox),
      cc: (m.ccRecipients ?? []).map(graphAddress),
      html,
      text: html === null ? (m.body?.content ?? null) : null,
      webLink: m.webLink ?? null,
      messageIdHeader: m.internetMessageId ?? null,
      references: null,
    };
  }

  async send(accessToken: string, email: OutgoingEmail) {
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    if (email.replyTo) {
      // The reply keeps the conversation and quotes the original; `comment` is the new text.
      await call(
        `${MicrosoftMail.API}/messages/${encodeURIComponent(email.replyTo.id)}/reply`,
        { method: "POST", headers, body: JSON.stringify({ message: { toRecipients: recipients([email.to]), ccRecipients: recipients(email.cc) }, comment: email.body }) },
        "Outlook reply",
      );
      return;
    }
    await call(
      `${MicrosoftMail.API}/sendMail`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: { subject: email.subject, body: { contentType: "Text", content: email.body }, toRecipients: recipients([email.to]), ccRecipients: recipients(email.cc) },
          saveToSentItems: true,
        }),
      },
      "Outlook send",
    );
  }
}
