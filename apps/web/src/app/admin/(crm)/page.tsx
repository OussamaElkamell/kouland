"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { useLoad } from "@/admin/hooks";
import { useCan, useSession } from "@/admin/session";
import { EmptyState, ErrorNotice, LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

/**
 * The central workspace: one card per platform section the account works in, read from the platform settings.
 * The full dashboard (statistics, recent activity, tasks) comes in Milestone 3.
 */
export default function OverviewPage() {
  const t = useTranslations("overview");
  const { user } = useSession();
  const { can, isAdmin } = useCan();
  const platforms = useLoad(() => api.platforms.list(), []);

  return (
    <>
      <PageHeader title={t("title", { name: user.name.split(" ")[0] ?? user.name })} subtitle={t("subtitle")} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {can("CUSTOMERS", "VIEW") && (
          <Link href="/admin/customers" className="card card-hover flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-text-muted">
              <Icon name="users" />
            </span>
            <span>
              <span className="block font-display font-bold">{t("customersTitle")}</span>
              <span className="block text-sm text-text-muted">{t("customersBody")}</span>
            </span>
          </Link>
        )}
        {can("SALES", "VIEW") && (
          <Link href="/admin/sales" className="card card-hover flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-text-muted">
              <Icon name="chart" />
            </span>
            <span>
              <span className="block font-display font-bold">{t("salesTitle")}</span>
              <span className="block text-sm text-text-muted">{t("salesBody")}</span>
            </span>
          </Link>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-bold">{t("platformsTitle")}</h2>
      {platforms.error ? (
        <ErrorNotice message={platforms.error.message} onRetry={platforms.reload} />
      ) : !platforms.data ? (
        <div className="card">
          <LoadingRows rows={3} />
        </div>
      ) : platforms.data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="globe"
            title={t("noPlatforms")}
            body={isAdmin ? t("noPlatformsAdmin") : t("noPlatformsUser")}
            action={
              isAdmin && (
                <Link href="/admin/settings/platforms" className="btn btn-primary btn-sm">
                  {t("addPlatform")}
                </Link>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {platforms.data.map((platform) => (
            <li key={platform.id}>
              <Link href={`/admin/p/${platform.slug}`} className="card card-hover flex h-full flex-col p-5">
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: platform.color }} aria-hidden="true" />
                  <span className="font-display text-lg font-bold">{platform.name}</span>
                </span>
                {platform.description && <span className="mt-2 line-clamp-2 text-sm text-text-muted">{platform.description}</span>}
                <span className="mt-auto flex gap-6 pt-4 text-sm">
                  <span>
                    <span className="block font-display text-xl font-extrabold">{platform.customerCount}</span>
                    <span className="text-text-muted">{t("customerCount")}</span>
                  </span>
                  <span>
                    <span className="block font-display text-xl font-extrabold">{platform.opportunityCount}</span>
                    <span className="text-text-muted">{t("opportunityCount")}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
