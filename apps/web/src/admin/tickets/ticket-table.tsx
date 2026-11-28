"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat, useLoad } from "@/admin/hooks";
import { TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/admin/labels";
import { useSession } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, LoadingRows, Pagination, PlatformChip, Select } from "@/admin/ui";
import { api } from "@/lib/api";

const PAGE_SIZE = 25;
type View = "active" | "mine" | "urgent" | "unassigned" | "done" | "all";

/** Tickets with quick views and filters. `platformId` / `customerId` fix the list; `compact` hides the filters. */
export function TicketTable({ platformId, customerId, compact = false, emptyAction }: { platformId?: string; customerId?: string; compact?: boolean; emptyAction?: React.ReactNode }) {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const { user } = useSession();
  const departments = useLoad(() => api.departments.list(), []);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>(compact ? "all" : "active");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [department, setDepartment] = useState("");
  const [platform, setPlatform] = useState(platformId ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [q, view, status, priority, department, platform]);

  const list = useLoad(
    () =>
      api.tickets.list({
        q: q || undefined,
        status: status || undefined,
        state: status ? undefined : view === "done" ? "done" : view === "all" ? undefined : "active",
        urgent: view === "urgent" && !priority ? "1" : undefined,
        priority: priority || undefined,
        assigneeId: view === "mine" ? "me" : view === "unassigned" ? "none" : undefined,
        departmentId: department || undefined,
        platformId: platform || undefined,
        customerId,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, view, status, priority, department, platform, customerId, page],
  );
  const items = list.data?.items ?? [];
  const views: View[] = ["active", "mine", "urgent", "unassigned", "done", "all"];

  return (
    <div className={compact ? "" : "card overflow-hidden"}>
      {!compact && (
        <>
          <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2" role="tablist">
            {views.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => {
                  setView(item);
                  setStatus("");
                }}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${view === item ? "border-brand text-text" : "border-transparent text-text-muted hover:text-text"}`}
              >
                {t(`views.${item}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 border-b p-4">
            <div className="relative min-w-[14rem] flex-1">
              <label htmlFor="ticket-search" className="sr-only">
                {tc("search")}
              </label>
              <input id="ticket-search" type="search" className="input !pl-9" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            </div>
            <Select id="ticket-status" value={status} onChange={(value) => setStatus(value as TicketStatus | "")} className="!w-auto">
              <option value="">{t("anyStatus")}</option>
              {TICKET_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {tStatus(`ticket.${value}`)}
                </option>
              ))}
            </Select>
            <Select id="ticket-priority" value={priority} onChange={(value) => setPriority(value as TicketPriority | "")} className="!w-auto">
              <option value="">{t("anyPriority")}</option>
              {TICKET_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {tStatus(`priority.${value}`)}
                </option>
              ))}
            </Select>
            <Select id="ticket-department" value={department} onChange={setDepartment} className="!w-auto">
              <option value="">{t("anyDepartment")}</option>
              {(departments.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            {!platformId && user.platforms.length > 1 && (
              <Select id="ticket-platform" value={platform} onChange={setPlatform} className="!w-auto">
                <option value="">{tc("allPlatforms")}</option>
                {user.platforms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </>
      )}

      {list.error ? (
        <div className="p-4">
          <ErrorNotice message={list.error.message} onRetry={list.reload} />
        </div>
      ) : !list.data ? (
        <LoadingRows rows={compact ? 2 : 5} />
      ) : items.length === 0 ? (
        compact ? (
          <p className="text-sm text-text-muted">{t("noneForCustomer")}</p>
        ) : (
          <EmptyState icon="ticket" title={t("empty")} body={t("emptyBody")} action={view === "active" ? emptyAction : undefined} />
        )
      ) : (
        <>
          <ul className={compact ? "divide-y" : "divide-y"}>
            {items.map((ticket) => (
              <li key={ticket.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${compact ? "py-3" : "px-5 py-3.5"} hover:bg-surface-2/40`}>
                <span className="w-14 flex-none font-mono text-xs text-text-faint">#{ticket.number}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/tickets/${ticket.id}`} className="font-semibold hover:text-brand-text">
                    {ticket.subject}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {[ticket.customer?.name ?? ticket.requesterName, ticket.department?.name, format.date(ticket.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {ticket.platform && !platformId && <PlatformChip platform={ticket.platform} size="sm" />}
                  <Badge tone={TICKET_PRIORITY_TONE[ticket.priority]}>{tStatus(`priority.${ticket.priority}`)}</Badge>
                  <Badge tone={TICKET_STATUS_TONE[ticket.status]}>{tStatus(`ticket.${ticket.status}`)}</Badge>
                  <span className="hidden w-28 truncate text-xs text-text-muted md:inline">{ticket.assignee?.name ?? t("unassigned")}</span>
                </span>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
