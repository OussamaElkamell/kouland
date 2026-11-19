"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { Contacts } from "@/admin/customers/contacts";
import { History } from "@/admin/customers/history";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { STAGE_TONE } from "@/admin/labels";
import { OpportunityTable } from "@/admin/sales/opportunity-table";
import { useCan } from "@/admin/session";
import { Badge, ConfirmDialog, DetailList, ErrorNotice, LoadingRows, PageHeader, PlatformChip } from "@/admin/ui";
import { api } from "@/lib/api";

export default function CustomerPage() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useCan();
  const customer = useLoad(() => api.customers.get(id), [id]);
  const action = useSubmit();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (customer.error) {
    return (
      <>
        <PageHeader title={t("title")} back={{ href: "/admin/customers", label: t("title") }} />
        <ErrorNotice message={customer.error.status === 404 ? t("notFound") : customer.error.message} onRetry={customer.error.status === 404 ? undefined : customer.reload} />
      </>
    );
  }
  if (!customer.data) return <LoadingRows rows={6} />;
  const c = customer.data;
  const canEdit = can("CUSTOMERS", "EDIT");
  const nextStage = c.stage === "PROSPECT" ? "CUSTOMER" : "PROSPECT";
  const address = [c.addressLine, [c.postalCode, c.city].filter(Boolean).join(" "), c.region, c.country].filter(Boolean).join(", ");

  async function changeStage() {
    const done = await action.submit(async () => {
      await api.customers.setStage(id, nextStage);
      return true;
    });
    if (done) await customer.reload();
  }

  async function remove() {
    const done = await action.submit(async () => {
      await api.customers.remove(id);
      return true;
    });
    if (done) router.replace("/admin/customers");
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: t("title") }}
        title={c.displayName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STAGE_TONE[c.stage]}>{t(`stage.${c.stage}`)}</Badge>
            <span>{t(`type.${c.type}`)}</span>
            <span aria-hidden="true">·</span>
            <span>{t("since", { date: format.date(c.createdAt) })}</span>
          </span>
        }
        actions={
          <>
            {can("SALES", "EDIT") && (
              <Link href={`/admin/sales/new?customer=${c.id}`} className="btn btn-primary btn-sm">
                <Icon name="plus" className="h-4 w-4" />
                {t("newOpportunity")}
              </Link>
            )}
            {canEdit && (
              <>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void changeStage()} disabled={action.pending}>
                  {t(`markAs.${nextStage}`)}
                </button>
                <Link href={`/admin/customers/${c.id}/edit`} className="btn btn-outline btn-sm">
                  <Icon name="pencil" className="h-4 w-4" />
                  {tc("edit")}
                </Link>
              </>
            )}
            {can("CUSTOMERS", "MANAGE") && (
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" className="h-4 w-4" />
                {tc("delete")}
              </button>
            )}
          </>
        }
      />
      {action.formError && !confirmDelete && <ErrorNotice message={action.formError} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{t("details")}</h2>
            <DetailList
              items={[
                {
                  label: t("fields.email"),
                  value: c.email && (
                    <a href={`mailto:${c.email}`} className="text-brand-text hover:underline">
                      {c.email}
                    </a>
                  ),
                },
                { label: t("fields.phone"), value: c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a> },
                {
                  label: t("fields.website"),
                  value: c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-brand-text hover:underline">
                      {c.website.replace(/^https?:\/\//, "")}
                    </a>
                  ),
                },
                { label: t("fields.address"), value: address },
                { label: t("createdBy"), value: c.createdBy?.name },
              ]}
            />
            {c.notes && (
              <div className="mt-5 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{t("fields.notes")}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{c.notes}</p>
              </div>
            )}
          </section>

          {can("SALES", "VIEW") && (
            <section className="card p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-bold">{t("opportunities")}</h2>
              <OpportunityTable customerId={c.id} compact />
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{t("history")}</h2>
            <History
              customerId={c.id}
              activities={c.activities}
              onAdded={(activity) => customer.setData({ ...c, activities: [activity, ...c.activities] })}
            />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-3 font-display text-lg font-bold">{t("fields.platforms")}</h2>
            {c.platforms.length === 0 ? (
              <p className="text-sm text-text-muted">{t("noLinkedPlatforms")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {c.platforms.map((platform) => (
                  <Link key={platform.id} href={`/admin/p/${platform.slug}`}>
                    <PlatformChip platform={platform} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{c.type === "COMPANY" ? t("contacts") : t("otherContacts")}</h2>
            <Contacts customerId={c.id} contacts={c.contacts} canEdit={canEdit} onChange={() => void customer.reload()} />
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteTitle")}
        body={t("deleteBody", { name: c.displayName })}
        confirmLabel={tc("delete")}
        pending={action.pending}
        error={action.formError}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
