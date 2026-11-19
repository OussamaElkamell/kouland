"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { OPEN_STATUSES, type OpportunityStatus } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { OPPORTUNITY_TONE } from "@/admin/labels";
import { Proposals } from "@/admin/sales/proposals";
import { useCan } from "@/admin/session";
import { Badge, ConfirmDialog, DetailList, ErrorNotice, LoadingRows, PageHeader, PlatformChip } from "@/admin/ui";
import { api } from "@/lib/api";

export default function OpportunityPage() {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useCan();
  const opportunity = useLoad(() => api.opportunities.get(id), [id]);
  const action = useSubmit();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (opportunity.error) {
    return (
      <>
        <PageHeader title={t("title")} back={{ href: "/admin/sales", label: t("title") }} />
        <ErrorNotice
          message={opportunity.error.status === 404 ? t("notFound") : opportunity.error.message}
          onRetry={opportunity.error.status === 404 ? undefined : opportunity.reload}
        />
      </>
    );
  }
  if (!opportunity.data) return <LoadingRows rows={6} />;
  const o = opportunity.data;
  const canEdit = can("SALES", "EDIT");
  const currentStep = OPEN_STATUSES.indexOf(o.status);

  async function moveTo(status: OpportunityStatus) {
    const done = await action.submit(async () => {
      await api.opportunities.setStatus(id, { status });
      return true;
    });
    if (done) await opportunity.reload();
  }

  async function remove() {
    const done = await action.submit(async () => {
      await api.opportunities.remove(id);
      return true;
    });
    if (done) router.replace("/admin/sales");
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/sales", label: t("title") }}
        title={o.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={OPPORTUNITY_TONE[o.status]}>{tStatus(`opportunity.${o.status}`)}</Badge>
            <PlatformChip platform={o.platform} size="sm" />
            <Link href={`/admin/customers/${o.customer.id}`} className="font-semibold text-text hover:text-brand-text">
              {o.customer.name}
            </Link>
          </span>
        }
        actions={
          <>
            {canEdit && (
              <Link href={`/admin/sales/${o.id}/edit`} className="btn btn-outline btn-sm">
                <Icon name="pencil" className="h-4 w-4" />
                {tc("edit")}
              </Link>
            )}
            {can("SALES", "MANAGE") && (
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" className="h-4 w-4" />
                {tc("delete")}
              </button>
            )}
          </>
        }
      />
      {action.formError && !confirmDelete && <ErrorNotice message={action.formError} />}

      {/* Pipeline: click a step to move the opportunity there. */}
      <section className="card mb-6 p-5 sm:p-6" aria-label={t("pipeline")}>
        <ol className="flex flex-wrap items-center gap-2">
          {OPEN_STATUSES.map((status, index) => {
            const reached = currentStep >= 0 ? index <= currentStep : o.status === "WON";
            const current = o.status === status;
            return (
              <li key={status} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canEdit || current || action.pending}
                  onClick={() => void moveTo(status)}
                  aria-current={current ? "step" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    current ? "border-brand bg-brand/10 text-brand-text" : reached ? "border-brand/40 text-text" : "text-text-muted"
                  } ${canEdit && !current ? "hover:border-brand/60" : ""}`}
                >
                  {tStatus(`opportunity.${status}`)}
                </button>
                {index < OPEN_STATUSES.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            <button type="button" className="btn btn-outline btn-sm" disabled={o.status === "WON" || action.pending} onClick={() => void moveTo("WON")}>
              <Icon name="check" className="h-4 w-4 text-success" />
              {t("markWon")}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={o.status === "LOST" || action.pending} onClick={() => void moveTo("LOST")}>
              <Icon name="close" className="h-4 w-4 text-error" />
              {t("markLost")}
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{t("proposalsTitle")}</h2>
            <Proposals
              opportunityId={o.id}
              currency={o.currency}
              proposals={o.proposals}
              canEdit={canEdit}
              canDelete={can("SALES", "MANAGE")}
              onChange={() => void opportunity.reload()}
            />
          </section>
          {o.request && (
            <section className="card p-5 sm:p-6">
              <h2 className="mb-2 font-display text-lg font-bold">{t("form.request")}</h2>
              <p className="whitespace-pre-line text-sm">{o.request}</p>
            </section>
          )}
        </div>
        <section className="card h-fit p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">{t("details")}</h2>
          <DetailList
            items={[
              { label: t("form.value"), value: format.money(o.estimatedValue, o.currency) },
              { label: t("form.closeDate"), value: o.expectedCloseDate && format.date(o.expectedCloseDate) },
              { label: t("form.owner"), value: o.owner?.name ?? t("form.noOwner") },
              { label: t("form.source"), value: t(`source.${o.source}`) },
              { label: t("created"), value: format.date(o.createdAt) },
              { label: t("closedOn"), value: o.closedAt && format.date(o.closedAt) },
              { label: t("form.lostReason"), value: o.status === "LOST" ? o.lostReason : null },
            ]}
          />
          <p className="mt-5 border-t pt-4 text-xs text-text-muted">{t("historyHint")}</p>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteTitle")}
        body={t("deleteBody", { title: o.title })}
        confirmLabel={tc("delete")}
        pending={action.pending}
        error={action.formError}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
