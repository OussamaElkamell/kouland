import type { CrmLocale } from "@kouland/contracts";
import { escapeHtml } from "../mail/escape-html";

/** The notification types that are also emailed: things given to one person, and their reminders. */
export type EmailedType = "TICKET_ASSIGNED" | "TASK_ASSIGNED" | "APPOINTMENT_ASSIGNED" | "TASK_REMINDER" | "APPOINTMENT_REMINDER";

type Words = { subject: (d: Record<string, string>) => string; line: (d: Record<string, string>) => string };

const TEXT: Record<CrmLocale, Record<EmailedType, Words> & { hello: (n: string) => string; open: string; footer: string }> = {
  en: {
    TICKET_ASSIGNED: { subject: (d) => `Ticket #${d.number} assigned to you`, line: (d) => `${d.by} assigned ticket #${d.number} "${d.title}" to you.` },
    TASK_ASSIGNED: { subject: (d) => `New task: ${d.title}`, line: (d) => `${d.by} gave you the task "${d.title}"${d.when ? `, due ${d.when}` : ""}.` },
    APPOINTMENT_ASSIGNED: { subject: (d) => `New appointment: ${d.title}`, line: (d) => `${d.by} scheduled "${d.title}" for you on ${d.when}.` },
    TASK_REMINDER: { subject: (d) => `Reminder: ${d.title}`, line: (d) => `Reminder for your task "${d.title}"${d.when ? `, due ${d.when}` : ""}.` },
    APPOINTMENT_REMINDER: { subject: (d) => `Reminder: ${d.title}`, line: (d) => `Reminder: your appointment "${d.title}" is on ${d.when}.` },
    hello: (n) => `Hello ${n},`,
    open: "Open in Kouland CRM",
    footer: "You receive this email because you have a Kouland CRM account.",
  },
  fr: {
    TICKET_ASSIGNED: { subject: (d) => `Ticket n° ${d.number} qui vous est attribué`, line: (d) => `${d.by} vous a attribué le ticket n° ${d.number} « ${d.title} ».` },
    TASK_ASSIGNED: { subject: (d) => `Nouvelle tâche : ${d.title}`, line: (d) => `${d.by} vous a confié la tâche « ${d.title} »${d.when ? `, à faire pour le ${d.when}` : ""}.` },
    APPOINTMENT_ASSIGNED: { subject: (d) => `Nouveau rendez-vous : ${d.title}`, line: (d) => `${d.by} a planifié « ${d.title} » pour vous le ${d.when}.` },
    TASK_REMINDER: { subject: (d) => `Rappel : ${d.title}`, line: (d) => `Rappel pour votre tâche « ${d.title} »${d.when ? `, à faire pour le ${d.when}` : ""}.` },
    APPOINTMENT_REMINDER: { subject: (d) => `Rappel : ${d.title}`, line: (d) => `Rappel : votre rendez-vous « ${d.title} » a lieu le ${d.when}.` },
    hello: (n) => `Bonjour ${n},`,
    open: "Ouvrir dans Kouland CRM",
    footer: "Vous recevez cet e-mail car vous avez un compte Kouland CRM.",
  },
  es: {
    TICKET_ASSIGNED: { subject: (d) => `Ticket n.º ${d.number} asignado a usted`, line: (d) => `${d.by} le asignó el ticket n.º ${d.number} «${d.title}».` },
    TASK_ASSIGNED: { subject: (d) => `Nueva tarea: ${d.title}`, line: (d) => `${d.by} le asignó la tarea «${d.title}»${d.when ? `, para el ${d.when}` : ""}.` },
    APPOINTMENT_ASSIGNED: { subject: (d) => `Nueva cita: ${d.title}`, line: (d) => `${d.by} programó «${d.title}» para usted el ${d.when}.` },
    TASK_REMINDER: { subject: (d) => `Recordatorio: ${d.title}`, line: (d) => `Recordatorio de su tarea «${d.title}»${d.when ? `, para el ${d.when}` : ""}.` },
    APPOINTMENT_REMINDER: { subject: (d) => `Recordatorio: ${d.title}`, line: (d) => `Recordatorio: su cita «${d.title}» es el ${d.when}.` },
    hello: (n) => `Hola ${n}:`,
    open: "Abrir en Kouland CRM",
    footer: "Recibe este correo porque tiene una cuenta de Kouland CRM.",
  },
};

const INTL: Record<CrmLocale, string> = { en: "en-US", fr: "fr-FR", es: "es-ES" };

/** A date and time worded for the person, in the company's time zone. */
export function formatWhen(iso: string | null | undefined, locale: CrmLocale): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: "medium", timeStyle: "short", timeZone: process.env.CRM_TIME_ZONE || "America/Chicago" }).format(
    new Date(iso),
  );
}

export function buildNotificationEmail(input: {
  type: EmailedType;
  locale: CrmLocale;
  name: string;
  data: Record<string, string>;
  url: string;
}): { subject: string; html: string; text: string } {
  const t = TEXT[input.locale];
  const words = t[input.type];
  const subject = words.subject(input.data);
  const line = words.line(input.data);
  const e = escapeHtml;
  const text = [t.hello(input.name), "", line, "", `${t.open}: ${input.url}`, "", t.footer].join("\n");
  const html = `<!doctype html>
<html lang="${input.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:16px 32px;background:#D10F2C;background-image:linear-gradient(135deg,#E81C3A,#D10F2C 50%,#9E0A21);">
        <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;">Kouland CRM</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 12px;font-size:16px;color:#0f172a;">${e(t.hello(input.name))}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#0f172a;">${e(line)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:999px;background:#D10F2C;">
          <a href="${e(input.url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${e(t.open)}</a>
        </td></tr></table>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">${e(t.footer)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  return { subject, html, text };
}
