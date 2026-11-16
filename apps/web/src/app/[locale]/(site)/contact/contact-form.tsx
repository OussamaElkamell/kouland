"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@kouland/api-client";
import { createContactMessageSchema, type CreateContactMessageInput } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { api } from "@/lib/api";

type FieldName = keyof CreateContactMessageInput;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; reason: "tooMany" | "network" | "generic" };

const EMPTY: Record<FieldName, string> = { name: "", email: "", phone: "", company: "", subject: "", message: "" };
const FIELDS = Object.keys(EMPTY) as FieldName[];

/**
 * Which fields failed, from either the shared schema or the API's response. The rules come from
 * @kouland/contracts; the messages shown are translated per field (`contactPage.form.errors.<field>`).
 */
function invalidFields(errors: Partial<Record<string, string[]>>): Set<FieldName> {
  return new Set(FIELDS.filter((field) => (errors[field]?.length ?? 0) > 0));
}

export function ContactForm() {
  const t = useTranslations("contactPage.form");
  const [values, setValues] = useState(EMPTY);
  const [invalid, setInvalid] = useState<Set<FieldName>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const errorFor = (name: FieldName) => (invalid.has(name) ? t(`errors.${name}`) : undefined);
  const control = (name: FieldName) => ({
    id: `contact-${name}`,
    name,
    value: values[name],
    invalid: invalid.has(name),
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Same schema the API validates with, so the visitor sees problems before anything is sent.
    const parsed = createContactMessageSchema.safeParse(values);
    if (!parsed.success) {
      setInvalid(invalidFields(parsed.error.flatten().fieldErrors));
      setStatus({ kind: "idle" });
      return;
    }

    setInvalid(new Set());
    setStatus({ kind: "sending" });
    try {
      await api.contact.send(values);
      setValues(EMPTY);
      setStatus({ kind: "sent" });
    } catch (error) {
      if (error instanceof ApiError) {
        setInvalid(invalidFields(error.fieldErrors));
        setStatus({ kind: "failed", reason: error.status === 429 ? "tooMany" : error.status === 0 ? "network" : "generic" });
      } else {
        setStatus({ kind: "failed", reason: "generic" });
      }
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col items-start gap-4" role="status">
        <span className="badge badge-success">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
          {t("sent.badge")}
        </span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">{t("sent.title")}</h2>
        <p className="text-text-muted">{t("sent.body")}</p>
        <button type="button" className="btn btn-outline" onClick={() => setStatus({ kind: "idle" })}>
          {t("sent.again")}
        </button>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const optional = t("optional");
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor="contact-name" label={t("name")} error={errorFor("name")}>
          <Input {...control("name")} autoComplete="name" required />
        </Field>
        <Field htmlFor="contact-email" label={t("email")} error={errorFor("email")}>
          <Input {...control("email")} type="email" autoComplete="email" required />
        </Field>
        <Field htmlFor="contact-phone" label={t("phone")} optionalLabel={optional} error={errorFor("phone")}>
          <Input {...control("phone")} type="tel" autoComplete="tel" />
        </Field>
        <Field htmlFor="contact-company" label={t("company")} optionalLabel={optional} error={errorFor("company")}>
          <Input {...control("company")} autoComplete="organization" />
        </Field>
      </div>
      <Field htmlFor="contact-subject" label={t("subject")} optionalLabel={optional} error={errorFor("subject")}>
        <Input {...control("subject")} />
      </Field>
      <Field htmlFor="contact-message" label={t("message")} error={errorFor("message")}>
        <Textarea {...control("message")} rows={6} required />
      </Field>

      {status.kind === "failed" && (
        <p className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {t(`errors.${status.reason}`)}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-lg self-start" disabled={sending}>
        {sending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
