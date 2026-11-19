import type { JobApplication } from "@kouland/contracts";
import { escapeHtml } from "../mail/escape-html";

/** How the stored codes read in the (English) email to the hiring inbox. */
const LABELS = {
  area: { host: "KoulandHost", route: "KoulandRoute", bot: "KoulandBot", event: "KoulandEvent", tech: "KoulandTech", company: "Kouland Technology (company teams)" },
  employmentType: { fullTime: "Full-time", partTime: "Part-time", contract: "Contract / freelance", internship: "Internship" },
  workMode: { onSite: "On-site", remote: "Remote", hybrid: "Hybrid" },
  experienceLevel: { lessThan1: "Less than 1 year", "1to3": "1 to 3 years", "3to5": "3 to 5 years", moreThan5: "More than 5 years" },
} as const;
const LANGUAGES = { en: "English", fr: "French", es: "Spanish" } as const;

export interface ApplicationEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * The email the hiring inbox receives for a new application. The CV is attached by the caller and replies go to
 * the applicant. Inline styles only: email clients ignore <style> blocks and CSS variables.
 */
export function buildApplicationEmail(application: JobApplication, locale: "en" | "fr" | "es", receivedAt: Date): ApplicationEmail {
  const area = LABELS.area[application.area];
  const subject = `Job application: ${application.position} (${area}) from ${application.fullName}`;
  const received = receivedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const sections: Array<[string, Array<[string, string | undefined]>]> = [
    [
      "Applicant",
      [
        ["Name", application.fullName],
        ["Email", application.email],
        ["Phone", application.phone],
        ["Location", `${application.city}, ${application.country}`],
      ],
    ],
    [
      "Role",
      [
        ["Platform or team", area],
        ["Position", application.position],
        ["Type", LABELS.employmentType[application.employmentType]],
        ["Work mode", LABELS.workMode[application.workMode]],
      ],
    ],
    [
      "Experience",
      [
        ["Experience", LABELS.experienceLevel[application.experienceLevel]],
        ["Skills", application.skills],
        ["LinkedIn", application.linkedinUrl],
        ["Portfolio", application.portfolioUrl],
      ],
    ],
    [
      "Availability",
      [
        ["Available from", application.availableFrom],
        ["Salary expectation", application.salaryExpectation],
        ["Website language", LANGUAGES[locale]],
        ["Received", received],
      ],
    ],
  ];
  const filled = sections.map(([title, rows]) => [title, rows.filter((row): row is [string, string] => Boolean(row[1]))] as const);

  const text = [
    "New job application from the kouland.com careers page. The CV is attached.",
    "",
    ...filled.flatMap(([title, rows]) => [title.toUpperCase(), ...rows.map(([label, value]) => `${label}: ${value}`), ""]),
    "WHY KOULAND",
    application.motivation,
    "",
    "Reply to this email to answer the applicant directly.",
  ].join("\n");

  const e = escapeHtml;
  const isLink = (label: string) => label === "LinkedIn" || label === "Portfolio";
  const cell = (label: string, value: string) =>
    label === "Email"
      ? `<a href="mailto:${e(value)}" style="color:#D10F2C;">${e(value)}</a>`
      : isLink(label)
        ? `<a href="${e(value)}" style="color:#D10F2C;word-break:break-all;">${e(value)}</a>`
        : e(value);
  const htmlSections = filled
    .map(
      ([title, rows]) =>
        `<p style="margin:20px 0 6px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#D10F2C;">${title}</p>` +
        `<table role="presentation" cellspacing="0" cellpadding="0">${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 16px 4px 0;font-size:14px;color:#64748b;white-space:nowrap;vertical-align:top;">${label}</td>` +
              `<td style="padding:4px 0;font-size:14px;color:#0f172a;">${cell(label, value)}</td></tr>`,
          )
          .join("")}</table>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:18px 32px;background:#D10F2C;background-image:linear-gradient(135deg,#E81C3A,#D10F2C 50%,#9E0A21);">
        <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Kouland Technology, Inc.</p>
        <p style="margin:2px 0 0;font-size:13px;color:#FFE4E8;">New job application · CV attached</p>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        ${htmlSections}
        <p style="margin:20px 0 6px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#D10F2C;">Why Kouland</p>
        <div style="padding:16px 18px;background:#f1f5f9;border-left:4px solid #D10F2C;border-radius:6px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${e(application.motivation)}</p>
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Reply to this email to answer ${e(application.fullName)} directly.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
