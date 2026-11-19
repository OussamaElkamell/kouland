"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat, useLoad } from "@/admin/hooks";
import { OPPORTUNITY_TONE } from "@/admin/labels";
import { useSession } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, LoadingRows, Pagination, PlatformChip, Select } from "@/admin/ui";
import { api } from "@/lib/api";

const PAGE_SIZE = 25;
type StateFilter = "open" | "closed" | "";

/**
 * Opportunities with search and filters. `platformId` or `customerId` fix the list to one platform section or one
 * customer; `compact` hides the filters (inside a customer's page).
 */
export function OpportunityTable({
  platformId,
  customerId,
  compact = false,
  emptyAction,
}: {
  platformId?: string;
  customerId?: string;
  compact?: boolean;
  emptyAction?: React.ReactNode;
}) {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateFilter>(compact ? "" : "open");
  const [status, setStatus] = useState<OpportunityStatus | "">("");
  const [platform, setPlatform] = useState(platformId ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [q, state, status, platform]);

  const list = useLoad(
    () =>
      api.opportunities.list({
        q: q || undefined,
        state: status ? undefined : state || undefined,
        status: status || undefined,
        platformId: platform || undefined,
        customerId,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, state, status, platform, customerId, page],
  );
  const filtered = Boolean(q || status || (platform && !platformId));

  return (
    <div className={compact ? "" : "card overflow-hidden"}>
      {!compact && (
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="opportunity-search" className="sr-only">
              {tc("search")}
            </label>
            <input
              id="opportunity-search"
              type="search"
              className="input !pl-9"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          </div>
          <Select id="opportunity-state" value={status ? "" : state} onChange={(value) => { setStatus(""); setState(value as StateFilter); }} className="!w-auto">
            <option value="open">{t("open")}</option>
            <option value="closed">{t("closed")}</option>
            <option value="">{t("allStates")}</option>
          </Select>
          <Select id="opportunity-status" value={status} onChange={(value) => setStatus(value as OpportunityStatus | "")} className="!w-auto">
            <option value="">{t("anyStatus")}</option>
            {OPPORTUNITY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {tStatus(`opportunity.${value}`)}
              </option>
            ))}
          </Select>
          {!platformId && user.platforms.length > 1 && (
            <Select id="opportunity-platform" value={platform} onChange={setPlatform} className="!w-auto">
              <option value="">{tc("allPlatforms")}</option>
              {user.platforms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {list.error ? (
        <div className="p-4">
          <ErrorNotice message={list.error.message} onRetry={list.reload} />
        </div>
      ) : !list.data ? (
        <LoadingRows rows={compact ? 2 : 5} />
      ) : list.data.items.length === 0 ? (
        compact ? (
          <p className="text-sm text-text-muted">{t("noneForCustomer")}</p>
        ) : (
          <EmptyState
            icon="chart"
            title={filtered ? t("noMatch") : t("empty")}
            body={filtered ? t("noMatchBody") : t("emptyBody")}
            action={filtered ? undefined : emptyAction}
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`border-b text-xs uppercase tracking-wide text-text-faint ${compact ? "" : "bg-surface-2/50"}`}>
                <tr>
                  <th scope="col" className={`${compact ? "py-3 pr-4" : "px-5 py-3"} font-semibold`}>{t("columns.title")}</th>
                  <th scope="col" className={`${compact ? "py-3 pr-4" : "px-5 py-3"} font-semibold`}>{t("columns.status")}</th>
                  <th scope="col" className={`hidden ${compact ? "py-3" : "px-5 py-3"} text-right font-semibold sm:table-cell`}>{t("columns.value")}</th>
                  {!platformId && !compact && <th scope="col" className="hidden px-5 py-3 font-semibold lg:table-cell">{t("columns.platform")}</th>}
                  {!compact && <th scope="col" className="hidden px-5 py-3 font-semibold md:table-cell">{t("columns.owner")}</th>}
                  {!compact && <th scope="col" className="hidden px-5 py-3 font-semibold xl:table-cell">{t("columns.close")}</th>}
                </tr>
              </thead>
              <tbody className={list.loading ? "opacity-60" : ""}>
                {list.data.items.map((opportunity) => (
                  <tr key={opportunity.id} className="border-b last:border-0 hover:bg-surface-2/40">
                    <td className={compact ? "py-3 pr-4" : "px-5 py-3"}>
                      <Link href={`/admin/sales/${opportunity.id}`} className="font-semibold hover:text-brand-text">
                        {opportunity.title}
                      </Link>
                      {!customerId && <span className="block text-xs text-text-muted">{opportunity.customer.name}</span>}
                    </td>
                    <td className={compact ? "py-3 pr-4" : "px-5 py-3"}>
                      <Badge tone={OPPORTUNITY_TONE[opportunity.status]}>{tStatus(`opportunity.${opportunity.status}`)}</Badge>
                    </td>
                    <td className={`hidden ${compact ? "py-3" : "px-5 py-3"} text-right font-semibold sm:table-cell`}>{format.money(opportunity.estimatedValue, opportunity.currency)}</td>
                    {!platformId && !compact && (
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <PlatformChip platform={opportunity.platform} size="sm" />
                      </td>
                    )}
                    {!compact && <td className="hidden px-5 py-3 text-text-muted md:table-cell">{opportunity.owner?.name ?? "—"}</td>}
                    {!compact && <td className="hidden px-5 py-3 text-text-muted xl:table-cell">{format.date(opportunity.expectedCloseDate)}</td>}
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
