"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@kouland/api-client";
import { supportRequestSchema } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { api } from "@/lib/api";

type FieldName = "name" | "email" | "phone" | "platformId" | "subject" | "description";
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; number: number } | { kind: "failed"; reason: "tooMany" | "network" | "generic" };

const EMPTY: Record<FieldName, string> = { name: "", email: "", phone: "", platformId: "", subject: "", description: "" };
const FIELDS = Object.keys(EMPTY) as FieldName[];
const invalidFields = (errors: Partial<Record<string, string[]>>) => new Set(FIELDS.filter((field) => (errors[field]?.length ?? 0) > 0));

/**
 * "Report an issue": creates a support ticket in the CRM. The services offered are the platforms configured in the
 * CRM, read from the API, so a new platform appears here without a code change.
 */
export function SupportForm() {
  const t = useTranslations("supportPage.form");
  const [values, setValues] = useState(EMPTY);
  const [invalid, setInvalid] = useState<Set<FieldName>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [platforms, setPlatforms] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    api.support
      .platforms()
      .then(setPlatforms)
      .catch(() => setPlatforms([]));
  }, []);

  const errorFor = (name: FieldName) => (invalid.has(name) ? t(`errors.${name}`) : undefined);
  const control = (name: FieldName) => ({
    id: `support-${name}`,
    name,
    value: values[name],
    invalid: invalid.has(name),
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...values, platformId: values.platformId || null };
    const parsed = supportRequestSchema.safeParse(input);
    if (!parsed.success) {
      setInvalid(invalidFields(parsed.error.flatten().fieldErrors));
      return;
    }
    setInvalid(new Set());
    setStatus({ kind: "sending" });
    try {
      const receipt = await api.support.send(input);
      setValues(EMPTY);
      setStatus({ kind: "sent", number: receipt.number });
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
          {t("sent.badge", { number: status.number })}
        </span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">{t("sent.title")}</h2>
        <p className="text-text-muted">{t("sent.body", { number: status.number })}</p>
        <button type="button" className="btn btn-outline" onClick={() => setStatus({ kind: "idle" })}>
          {t("sent.again")}
        </button>
      </div>
    );
  }

  const sending = status.kind === "sending";
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor="support-name" label={t("name")} error={errorFor("name")}>
          <Input {...control("name")} autoComplete="name" required />
        </Field>
        <Field htmlFor="support-email" label={t("email")} hint={t("emailHint")} error={errorFor("email")}>
          <Input {...control("email")} type="email" autoComplete="email" required />
        </Field>
        <Field htmlFor="support-phone" label={t("phone")} optionalLabel={t("optional")} error={errorFor("phone")}>
          <Input {...control("phone")} type="tel" autoComplete="tel" />
        </Field>
        <Field htmlFor="support-platformId" label={t("platform")} optionalLabel={t("optional")} error={errorFor("platformId")}>
          <select
            id="support-platformId"
            className="select"
            value={values.platformId}
            onChange={(event) => setValues((current) => ({ ...current, platformId: event.target.value }))}
          >
            <option value="">{t("platformUnsure")}</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field htmlFor="support-subject" label={t("subject")} error={errorFor("subject")}>
        <Input {...control("subject")} required />
      </Field>
      <Field htmlFor="support-description" label={t("description")} hint={t("descriptionHint")} error={errorFor("description")}>
        <Textarea {...control("description")} rows={6} required />
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
