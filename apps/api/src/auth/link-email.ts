import type { CrmLocale, TokenPurpose } from "@kouland/contracts";
import { escapeHtml } from "../mail/escape-html";

interface LinkEmailInput {
  purpose: TokenPurpose;
  locale: CrmLocale;
  name: string;
  /** Who sent the invitation, when known. */
  invitedBy: string | null;
  link: string;
  /** How long the link works, in hours. */
  validHours: number;
}

const TEXT = {
  en: {
    INVITE: {
      subject: "You are invited to Kouland CRM",
      intro: (by: string | null) => `${by ?? "An administrator"} has created a Kouland CRM account for you.`,
      action: "Choose your password",
      body: "Open the link below to choose your password and sign in.",
    },
    RESET_PASSWORD: {
      subject: "Choose a new password for Kouland CRM",
      intro: (by: string | null) => `${by ?? "An administrator"} has asked for a new password for your Kouland CRM account.`,
      action: "Choose a new password",
      body: "Open the link below to choose a new password. Your current password keeps working until then.",
    },
    hello: (name: string) => `Hello ${name},`,
    expires: (hours: number) => (hours >= 48 ? `The link works for ${hours / 24} days and only once.` : `The link works for ${hours} hours and only once.`),
    ignore: "If you were not expecting this email, you can ignore it.",
  },
  fr: {
    INVITE: {
      subject: "Votre invitation à Kouland CRM",
      intro: (by: string | null) => `${by ?? "Un administrateur"} vous a créé un compte Kouland CRM.`,
      action: "Choisir mon mot de passe",
      body: "Ouvrez le lien ci-dessous pour choisir votre mot de passe et vous connecter.",
    },
    RESET_PASSWORD: {
      subject: "Choisissez un nouveau mot de passe pour Kouland CRM",
      intro: (by: string | null) => `${by ?? "Un administrateur"} a demandé un nouveau mot de passe pour votre compte Kouland CRM.`,
      action: "Choisir un nouveau mot de passe",
      body: "Ouvrez le lien ci-dessous pour choisir un nouveau mot de passe. Votre mot de passe actuel reste valable d'ici là.",
    },
    hello: (name: string) => `Bonjour ${name},`,
    expires: (hours: number) =>
      hours >= 48 ? `Le lien est valable ${hours / 24} jours et une seule fois.` : `Le lien est valable ${hours} heures et une seule fois.`,
    ignore: "Si vous n'attendiez pas cet e-mail, vous pouvez l'ignorer.",
  },
  es: {
    INVITE: {
      subject: "Su invitación a Kouland CRM",
      intro: (by: string | null) => `${by ?? "Un administrador"} le ha creado una cuenta de Kouland CRM.`,
      action: "Elegir mi contraseña",
      body: "Abra el enlace de abajo para elegir su contraseña e iniciar sesión.",
    },
    RESET_PASSWORD: {
      subject: "Elija una nueva contraseña para Kouland CRM",
      intro: (by: string | null) => `${by ?? "Un administrador"} ha solicitado una nueva contraseña para su cuenta de Kouland CRM.`,
      action: "Elegir una nueva contraseña",
      body: "Abra el enlace de abajo para elegir una nueva contraseña. Su contraseña actual sigue funcionando hasta entonces.",
    },
    hello: (name: string) => `Hola ${name}:`,
    expires: (hours: number) =>
      hours >= 48 ? `El enlace es válido durante ${hours / 24} días y una sola vez.` : `El enlace es válido durante ${hours} horas y una sola vez.`,
    ignore: "Si no esperaba este correo, puede ignorarlo.",
  },
} as const;

/** The invitation or password email, in the person's CRM language. Inline styles only (email clients). */
export function buildLinkEmail(input: LinkEmailInput): { subject: string; html: string; text: string } {
  const t = TEXT[input.locale];
  const p = t[input.purpose];
  const e = escapeHtml;

  const text = [t.hello(input.name), "", p.intro(input.invitedBy), p.body, "", input.link, "", t.expires(input.validHours), t.ignore].join("\n");

  const html = `<!doctype html>
<html lang="${input.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(p.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:18px 32px;background:#D10F2C;background-image:linear-gradient(135deg,#E81C3A,#D10F2C 50%,#9E0A21);">
        <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Kouland CRM</p>
        <p style="margin:2px 0 0;font-size:13px;color:#FFE4E8;">Kouland Technology, Inc.</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 12px;font-size:16px;color:#0f172a;">${e(t.hello(input.name))}</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f172a;">${e(p.intro(input.invitedBy))}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${e(p.body)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:999px;background:#D10F2C;">
          <a href="${e(input.link)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${e(p.action)}</a>
        </td></tr></table>
        <p style="margin:24px 0 4px;font-size:13px;color:#64748b;">${e(t.expires(input.validHours))}</p>
        <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;word-break:break-all;">${e(input.link)}</p>
        <p style="margin:0;font-size:13px;color:#64748b;">${e(t.ignore)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject: p.subject, html, text };
}
