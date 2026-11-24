"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { CodeBlock, CodeTabs, CopyButton } from "@/admin/code-block";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { PAYLOAD_EXAMPLES, webhookSnippets } from "@/admin/integration-snippets";
import { useCan } from "@/admin/session";
import { Badge, ConfirmDialog, EmptyState, ErrorNotice, LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

/**
 * A platform's connection to the CRM: its webhook address and secret, code for the platform's developers, and the
 * events received. Any platform can be connected this way, with no change to the CRM.
 */
export default function PlatformIntegrationPage() {
  const t = useTranslations("integration");
  const tp = useTranslations("platformSettings");
  const format = useFormat();
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useCan();
  const platforms = useLoad(() => api.platforms.list(true), []);
  const integration = useLoad(() => api.integrations.get(id), [id]);
  const action = useSubmit();
  const [showSecret, setShowSecret] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  if (!isAdmin) return <ErrorNotice message={tp("adminOnly")} />;
  const platform = platforms.data?.find((p) => p.id === id);
  const back = { href: "/admin/settings/platforms", label: tp("title") };

  if (integration.error) {
    return (
      <>
        <PageHeader title={t("title")} back={back} />
        <ErrorNotice message={integration.error.message} onRetry={integration.reload} />
      </>
    );
  }
  if (!integration.data) return <LoadingRows rows={6} />;
  const data = integration.data;

  async function toggle() {
    const next = await action.submit(() => api.integrations.setEnabled(id, { enabled: !data.enabled }));
    if (next) integration.setData(next);
  }

  async function rotate() {
    const next = await action.submit(() => api.integrations.rotateSecret(id));
    if (next) {
      integration.setData(next);
      setShowSecret(true);
      setConfirmRotate(false);
    }
  }

  return (
    <>
      <PageHeader
        back={back}
        title={t("titleFor", { platform: platform?.name ?? "…" })}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={`btn btn-sm ${data.enabled ? "btn-outline" : "btn-primary"}`} onClick={() => void toggle()} disabled={action.pending}>
            {data.enabled ? t("turnOff") : t("turnOn")}
          </button>
        }
      />
      {action.formError && !confirmRotate && (
        <div className="mb-4">
          <ErrorNotice message={action.formError} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold">{t("connection")}</h2>
            <Badge tone={data.enabled ? "success" : "neutral"}>{data.enabled ? t("on") : t("off")}</Badge>
            {data.lastWebhookAt && <span className="text-xs text-text-muted">{t("lastReceived", { date: format.dateTime(data.lastWebhookAt) })}</span>}
          </div>
          {!data.enabled && !data.secret ? (
            <p className="text-sm text-text-muted">{t("offHint")}</p>
          ) : (
            <dl className="grid gap-4">
              <div>
                <dt className="field-label">{t("url")}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md bg-surface-2 px-2 py-1 text-xs">{data.webhookUrl}</code>
                  <CopyButton text={data.webhookUrl} />
                </dd>
              </div>
              {data.secret && (
                <div>
                  <dt className="field-label">{t("secret")}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-md bg-surface-2 px-2 py-1 text-xs">{showSecret ? data.secret : "•".repeat(32)}</code>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? t("hide") : t("show")}
                    </button>
                    <CopyButton text={data.secret} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmRotate(true)}>
                      {t("rotate")}
                    </button>
                  </dd>
                  <p className="field-hint">{t("secretHint")}</p>
                </div>
              )}
              {!data.enabled && <p className="text-sm text-warning">{t("offWarning")}</p>}
            </dl>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 font-display text-lg font-bold">{t("forDevelopers")}</h2>
          <p className="mb-4 text-sm text-text-muted">{t("forDevelopersBody")}</p>
          <ol className="mb-5 list-decimal space-y-1 pl-5 text-sm">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
            <li>{t("step4")}</li>
          </ol>
          <CodeTabs tabs={webhookSnippets(data.webhookUrl)} />
          <h3 className="mb-2 mt-6 font-display font-bold">{t("payloads")}</h3>
          <p className="mb-3 text-sm text-text-muted">{t("payloadsBody")}</p>
          <CodeBlock code={PAYLOAD_EXAMPLES} label="JSON" />
          <h3 className="mb-2 mt-6 font-display font-bold">{t("answers")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
            <li>{t("answer200")}</li>
            <li>{t("answer400")}</li>
            <li>{t("answer401")}</li>
            <li>{t("answer403")}</li>
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 pb-3 sm:px-6">
            <h2 className="font-display text-lg font-bold">{t("events")}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void integration.reload()}>
              <Icon name="arrow" className="h-4 w-4" />
              {t("refresh")}
            </button>
          </div>
          {data.events.length === 0 ? (
            <EmptyState icon="server" title={t("noEvents")} body={t("noEventsBody")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-surface-2/50 text-xs uppercase tracking-wide text-text-faint">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">{t("received")}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t("type")}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t("eventId")}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t("customer")}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t("result")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap px-5 py-3">{format.dateTime(event.receivedAt)}</td>
                      <td className="px-5 py-3">
                        <code className="text-xs">{event.type}</code>
                      </td>
                      <td className="max-w-[12rem] truncate px-5 py-3">
                        <code className="text-xs">{event.eventId}</code>
                      </td>
                      <td className="px-5 py-3">
                        {event.customer ? (
                          <Link href={`/admin/customers/${event.customer.id}`} className="font-semibold hover:text-brand-text">
                            {event.customer.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {event.created && <span className="ml-2 text-xs text-text-muted">{t("createdCustomer")}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={event.status === "PROCESSED" ? "success" : "error"}>{t(`status.${event.status}`)}</Badge>
                        {event.error && <p className="mt-1 max-w-md text-xs text-error">{event.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmRotate}
        title={t("rotateTitle")}
        body={t("rotateBody")}
        confirmLabel={t("rotate")}
        pending={action.pending}
        error={action.formError}
        onConfirm={() => void rotate()}
        onClose={() => setConfirmRotate(false)}
      />
    </>
  );
}
