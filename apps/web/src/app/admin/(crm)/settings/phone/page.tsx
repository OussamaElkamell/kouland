"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Field, Input } from "@kouland/ui";
import { CopyButton } from "@/admin/code-block";
import { useLoad, useSubmit } from "@/admin/hooks";
import { useCan } from "@/admin/session";
import { Badge, ErrorNotice, FormError, LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

/** Administrators: the company's Twilio number, where unanswered calls go, and the addresses to give Twilio. */
export default function PhoneSettingsPage() {
  const t = useTranslations("phoneSettings");
  const tc = useTranslations("common");
  const { isAdmin } = useCan();
  const settings = useLoad(() => api.phoneSettings.get(), []);
  const form = useSubmit();
  const [fallbackNumber, setFallbackNumber] = useState("");
  const [ringSeconds, setRingSeconds] = useState("20");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setFallbackNumber(settings.data.fallbackNumber ?? "");
    setRingSeconds(String(settings.data.ringSeconds));
  }, [settings.data]);

  if (!isAdmin) return <ErrorNotice message={t("adminOnly")} />;
  if (settings.error) return <ErrorNotice message={settings.error.message} onRetry={settings.reload} />;
  if (!settings.data) return <LoadingRows rows={5} />;
  const data = settings.data;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const next = await form.submit(() => api.phoneSettings.update({ fallbackNumber, ringSeconds: Number(ringSeconds) }));
    if (next) {
      settings.setData(next);
      setSaved(true);
    }
  }

  const urls = [
    { label: t("voiceUrl"), hint: t("voiceUrlHint"), value: data.voiceUrl },
    { label: t("statusUrl"), hint: t("statusUrlHint"), value: data.statusUrl },
    { label: t("smsUrl"), hint: t("smsUrlHint"), value: data.smsUrl },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold">{t("twilio")}</h2>
            <Badge tone={data.configured ? "success" : "warning"}>{data.configured ? t("connected") : t("notConnected")}</Badge>
          </div>
          {data.configured ? (
            <p className="text-sm">
              {t("companyNumber")}: <strong>{data.companyNumber}</strong>
            </p>
          ) : (
            <p className="text-sm text-text-muted">{t("notConnectedHint")}</p>
          )}
          <h3 className="mb-2 mt-5 font-display font-bold">{t("addresses")}</h3>
          <p className="mb-3 text-sm text-text-muted">{t("addressesHint")}</p>
          <dl className="flex flex-col gap-3">
            {urls.map((url) => (
              <div key={url.label}>
                <dt className="field-label">{url.label}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md bg-surface-2 px-2 py-1 text-xs">{url.value}</code>
                  <CopyButton text={url.value} />
                </dd>
                <p className="field-hint">{url.hint}</p>
              </div>
            ))}
          </dl>
        </section>

        <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-5 sm:p-6" noValidate>
          <h2 className="font-display text-lg font-bold">{t("routing")}</h2>
          <p className="text-sm text-text-muted">{t("routingHint")}</p>
          <FormError message={form.formError} />
          <Field htmlFor="fallback-number" label={t("fallbackNumber")} optionalLabel={tc("optional")} hint={t("fallbackNumberHint")} error={form.errorFor("fallbackNumber")}>
            <Input id="fallback-number" type="tel" placeholder="+19185550123" value={fallbackNumber} onChange={(e) => setFallbackNumber(e.target.value)} invalid={!!form.errorFor("fallbackNumber")} />
          </Field>
          <Field htmlFor="ring-seconds" label={t("ringSeconds")} hint={t("ringSecondsHint")} error={form.errorFor("ringSeconds")}>
            <Input id="ring-seconds" type="number" min={10} max={60} value={ringSeconds} onChange={(e) => setRingSeconds(e.target.value)} invalid={!!form.errorFor("ringSeconds")} />
          </Field>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-success">{tc("saved")}</span>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
