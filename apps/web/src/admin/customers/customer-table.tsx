"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CUSTOMER_STAGES, CUSTOMER_TYPES, type CustomerStage, type CustomerType } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat, useLoad } from "@/admin/hooks";
import { STAGE_TONE } from "@/admin/labels";
import { useSession } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, LoadingRows, Pagination, PlatformChip, Select } from "@/admin/ui";
import { api } from "@/lib/api";

const PAGE_SIZE = 25;

/** Searchable, filterable customer list. `platformId` fixes the platform (inside a platform section). */
export function CustomerTable({ platformId, emptyAction }: { platformId?: string; emptyAction?: React.ReactNode }) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const format = useFormat();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<CustomerStage | "">("");
  const [type, setType] = useState<CustomerType | "">("");
  const [platform, setPlatform] = useState(platformId ?? "");
  const [page, setPage] = useState(1);

  // Search after the user stops typing for a moment.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [q, stage, type, platform]);

  const list = useLoad(
    () =>
      api.customers.list({
        q: q || undefined,
        stage: stage || undefined,
        type: type || undefined,
        platformId: platform || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, stage, type, platform, page],
  );
  const filtered = Boolean(q || stage || type || (platform && !platformId));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="customer-search" className="sr-only">
            {tc("search")}
          </label>
          <input
            id="customer-search"
            type="search"
            className="input !pl-9"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        </div>
        <Select id="customer-stage" value={stage} onChange={(value) => setStage(value as CustomerStage | "")} className="!w-auto">
          <option value="">{t("allStages")}</option>
          {CUSTOMER_STAGES.map((value) => (
            <option key={value} value={value}>
              {t(`stage.${value}`)}
            </option>
          ))}
        </Select>
        <Select id="customer-type" value={type} onChange={(value) => setType(value as CustomerType | "")} className="!w-auto">
          <option value="">{t("allTypes")}</option>
          {CUSTOMER_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`type.${value}`)}
            </option>
          ))}
        </Select>
        {!platformId && user.platforms.length > 1 && (
          <Select id="customer-platform" value={platform} onChange={setPlatform} className="!w-auto">
            <option value="">{tc("allPlatforms")}</option>
            {user.platforms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {list.error ? (
        <div className="p-4">
          <ErrorNotice message={list.error.message} onRetry={list.reload} />
        </div>
      ) : !list.data ? (
        <LoadingRows />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon="users"
          title={filtered ? t("noMatch") : t("empty")}
          body={filtered ? t("noMatchBody") : t("emptyBody")}
          action={filtered ? undefined : emptyAction}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-2/50 text-xs uppercase tracking-wide text-text-faint">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("columns.name")}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("columns.stage")}</th>
                  <th scope="col" className="hidden px-5 py-3 font-semibold md:table-cell">{t("columns.contact")}</th>
                  <th scope="col" className="hidden px-5 py-3 font-semibold lg:table-cell">{t("columns.platforms")}</th>
                  <th scope="col" className="hidden px-5 py-3 text-right font-semibold sm:table-cell">{t("columns.open")}</th>
                  <th scope="col" className="hidden px-5 py-3 font-semibold xl:table-cell">{t("columns.updated")}</th>
                </tr>
              </thead>
              <tbody className={list.loading ? "opacity-60" : ""}>
                {list.data.items.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-surface-2/40">
                    <td className="px-5 py-3">
                      <Link href={`/admin/customers/${customer.id}`} className="font-semibold hover:text-brand-text">
                        {customer.displayName}
                      </Link>
                      <span className="block text-xs text-text-muted">
                        {t(`type.${customer.type}`)}
                        {customer.city ? ` · ${customer.city}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STAGE_TONE[customer.stage]}>{t(`stage.${customer.stage}`)}</Badge>
                    </td>
                    <td className="hidden px-5 py-3 text-text-muted md:table-cell">
                      <span className="block truncate">{customer.email ?? "—"}</span>
                      {customer.phone && <span className="block text-xs">{customer.phone}</span>}
                    </td>
                    <td className="hidden px-5 py-3 lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {customer.platforms.map((item) => (
                          <PlatformChip key={item.id} platform={item} size="sm" />
                        ))}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-right font-semibold sm:table-cell">{customer.openOpportunities}</td>
                    <td className="hidden px-5 py-3 text-text-muted xl:table-cell">{format.date(customer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
