import type { CreateContactMessage } from "@kouland/contracts";
import { escapeHtml } from "../mail/escape-html";

export interface ContactEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * The email the company inbox receives for a website contact message. Replies go to the visitor (set by
 * the caller as reply-to). Inline styles only: email clients ignore <style> blocks and CSS variables.
 */
export function buildContactEmail(message: CreateContactMessage, receivedAt: Date): ContactEmail {
  const subject = `Website message from ${message.name}${message.subject ? `: ${message.subject}` : ""}`;
  const rows: Array<[string, string | undefined]> = [
    ["Name", message.name],
    ["Email", message.email],
    ["Phone", message.phone],
    ["Company", message.company],
    ["Subject", message.subject],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const received = receivedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const text = [
    "New message from the kouland.com contact form.",
    "",
    ...filled.map(([label, value]) => `${label}: ${value}`),
    `Received: ${received}`,
    "",
    message.message,
    "",
    "Reply to this email to answer the visitor directly.",
  ].join("\n");

  const e = escapeHtml;
  const details = filled
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:14px;color:#64748b;white-space:nowrap;vertical-align:top;">${label}</td>` +
        `<td style="padding:6px 0;font-size:14px;color:#0f172a;">${label === "Email" ? `<a href="mailto:${e(value)}" style="color:#D10F2C;">${e(value)}</a>` : e(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:18px 32px;background:#D10F2C;background-image:linear-gradient(135deg,#E81C3A,#D10F2C 50%,#9E0A21);">
        <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Kouland Technology, Inc.</p>
        <p style="margin:2px 0 0;font-size:13px;color:#FFE4E8;">New message from the website contact form</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">${details}
          <tr><td style="padding:6px 16px 6px 0;font-size:14px;color:#64748b;">Received</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${received}</td></tr>
        </table>
        <div style="padding:16px 18px;background:#f1f5f9;border-left:4px solid #D10F2C;border-radius:6px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${e(message.message)}</p>
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Reply to this email to answer ${e(message.name)} directly.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
