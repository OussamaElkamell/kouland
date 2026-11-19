"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Activity } from "@kouland/contracts";
import { Icon, Textarea, type IconName } from "@kouland/ui";
import { useFormat, useSubmit } from "@/admin/hooks";
import { FormError } from "@/admin/ui";
import { api } from "@/lib/api";

const ICON: Record<Activity["type"], IconName> = {
  NOTE: "message",
  CUSTOMER_CREATED: "plus",
  CUSTOMER_UPDATED: "pencil",
  STAGE_CHANGED: "star",
  CONTACT_ADDED: "users",
  PLATFORM_LINKED: "globe",
  PLATFORM_UNLINKED: "globe",
  OPPORTUNITY_CREATED: "chart",
  OPPORTUNITY_STATUS: "chart",
  PROPOSAL_CREATED: "briefcase",
  PROPOSAL_STATUS: "briefcase",
};

/** One line per event, worded in the CRM language from the event's stored details. */
function useDescribe() {
  const t = useTranslations("history");
  const tCustomers = useTranslations("customers");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const str = (value: unknown) => (typeof value === "string" ? value : "");

  return (activity: Activity): string => {
    const data = activity.data ?? {};
    switch (activity.type) {
      case "STAGE_CHANGED":
        return t("STAGE_CHANGED", { to: tCustomers(`stage.${str(data.to) || "PROSPECT"}`) });
      case "CUSTOMER_UPDATED": {
        const fields = Array.isArray(data.fields) ? data.fields.map((field) => tCustomers(`fields.${String(field)}`)) : [];
        return t("CUSTOMER_UPDATED", { fields: fields.join(", ") });
      }
      case "OPPORTUNITY_STATUS":
        return t("OPPORTUNITY_STATUS", { title: str(data.title), to: tStatus(`opportunity.${str(data.to) || "NEW"}`) });
      case "OPPORTUNITY_CREATED":
        return t("OPPORTUNITY_CREATED", { title: str(data.title) });
      case "PROPOSAL_CREATED":
        return t("PROPOSAL_CREATED", {
          title: str(data.title),
          amount: format.money(typeof data.amount === "number" ? data.amount : null, str(data.currency) || "USD"),
        });
      case "PROPOSAL_STATUS":
        return t("PROPOSAL_STATUS", { title: str(data.title), to: tStatus(`proposal.${str(data.to) || "DRAFT"}`) });
      case "PLATFORM_LINKED":
      case "PLATFORM_UNLINKED":
        return t(activity.type, { platform: str(data.platform) });
      case "CONTACT_ADDED":
        return t("CONTACT_ADDED", { name: str(data.name) });
      case "CUSTOMER_CREATED":
        return t("CUSTOMER_CREATED");
      case "NOTE":
        return t("NOTE");
    }
  };
}

/** The customer's history, newest first, with a box to write a note. */
export function History({
  customerId,
  activities,
  onAdded,
  opportunityId,
}: {
  customerId: string;
  activities: Activity[];
  onAdded: (activity: Activity) => void;
  /** On an opportunity's screen: notes are attached to it and only its events are listed. */
  opportunityId?: string;
}) {
  const t = useTranslations("history");
  const format = useFormat();
  const describe = useDescribe();
  const { submit, pending, formError, errorFor } = useSubmit();
  const [body, setBody] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const note = await submit(() => api.customers.addNote(customerId, { body, opportunityId }));
    if (note) {
      onAdded(note);
      setBody("");
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-2" noValidate>
        <label htmlFor="note" className="sr-only">
          {t("notePlaceholder")}
        </label>
        <Textarea id="note" rows={3} placeholder={t("notePlaceholder")} value={body} onChange={(event) => setBody(event.target.value)} invalid={!!errorFor("body")} />
        {errorFor("body") && <p className="field-error">{errorFor("body")}</p>}
        <FormError message={formError} />
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !body.trim()}>
            {pending ? t("adding") : t("addNote")}
          </button>
        </div>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <ol className="relative flex flex-col gap-5 border-l pl-6">
          {activities.map((activity) => (
            <li key={activity.id} className="relative">
              <span className="absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full border bg-surface text-text-muted">
                <Icon name={ICON[activity.type]} className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold">{describe(activity)}</p>
              {activity.body && <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm">{activity.body}</p>}
              <p className="mt-1 text-xs text-text-faint">
                {format.dateTime(activity.createdAt)}
                {activity.user ? ` · ${activity.user.name}` : ""}
                {activity.opportunity && !opportunityId && (
                  <>
                    {" · "}
                    <Link href={`/admin/sales/${activity.opportunity.id}`} className="hover:text-text">
                      {activity.opportunity.title}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
