"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { useLoad, useSubmit } from "@/admin/hooks";
import { Badge, ErrorNotice, FormError, LoadingRows } from "@/admin/ui";
import { api } from "@/lib/api";

/** Connect the person's own Google Workspace or Microsoft 365 mailbox, or disconnect it. */
export function MailboxCard() {
  const t = useTranslations("email");
  const params = useSearchParams();
  const connection = useLoad(() => api.email.connection(), []);
  const action = useSubmit();
  const [notice] = useState(() => params.get("email"));
  const reason = params.get("reason");

  async function disconnect() {
    const done = await action.submit(async () => {
      await api.email.disconnect();
      return true;
    });
    if (done) await connection.reload();
  }

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{t("mailbox")}</h2>
      <p className="text-sm text-text-muted">{t("mailboxHint")}</p>
      {notice === "connected" && <p className="text-sm text-success">{t("connectedNotice")}</p>}
      {notice === "denied" && <p className="text-sm text-warning">{t("deniedNotice")}</p>}
      {notice === "error" && <ErrorNotice message={`${t("errorNotice")}${reason ? ` ${reason}` : ""}`} />}
      <FormError message={action.formError} />
      {connection.error ? (
        <ErrorNotice message={connection.error.message} onRetry={connection.reload} />
      ) : !connection.data ? (
        <LoadingRows rows={2} />
      ) : connection.data.email ? (
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="mail" className="h-5 w-5 text-brand-text" />
          <span className="font-semibold">{connection.data.email}</span>
          <Badge tone="success">{connection.data.provider === "GOOGLE" ? "Google Workspace" : "Microsoft 365"}</Badge>
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => void disconnect()} disabled={action.pending}>
            {t("disconnect")}
          </button>
        </div>
      ) : connection.data.available.length === 0 ? (
        <p className="text-sm text-text-muted">{t("noneAvailable")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {connection.data.available.includes("GOOGLE") && (
            <a href={api.email.connectUrl("google")} className="btn btn-outline btn-sm">
              {t("connectGoogle")}
            </a>
          )}
          {connection.data.available.includes("MICROSOFT") && (
            <a href={api.email.connectUrl("microsoft")} className="btn btn-outline btn-sm">
              {t("connectMicrosoft")}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
