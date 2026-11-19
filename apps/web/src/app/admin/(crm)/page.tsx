"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@kouland/ui";
import { AppointmentRow, TaskRow } from "@/admin/agenda/rows";
import { useFormat, useLoad } from "@/admin/hooks";
import { TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/admin/labels";
import { useCan, useSession } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, LoadingRows, PageHeader, Select } from "@/admin/ui";
import { api } from "@/lib/api";

/**
 * The central workspace: business statistics, urgent tickets and tasks, upcoming appointments and recent
 * activity, filterable by platform. Each block appears only for people with access to that area.
 */
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const { user } = useSession();
  const { isAdmin } = useCan();
  const [platformId, setPlatformId] = useState("");
  const dashboard = useLoad(() => api.dashboard.get(platformId || undefined), [platformId]);
  const platforms = useLoad(() => api.platforms.list(), []);
  const d = dashboard.data;

  return (
    <>
      <PageHeader
        title={t("title", { name: user.name.split(" ")[0] ?? user.name })}
        subtitle={t("subtitle")}
        actions={
          user.platforms.length > 1 && (
            <Select id="dashboard-platform" value={platformId} onChange={setPlatformId} className="!w-auto">
              <option value="">{tc("allPlatforms")}</option>
              {user.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </Select>
          )
        }
      />

      {dashboard.error ? (
        <ErrorNotice message={dashboard.error.message} onRetry={dashboard.reload} />
      ) : !d ? (
        <div className="card">
          <LoadingRows rows={6} />
        </div>
      ) : (
        <div className={`flex flex-col gap-6 ${dashboard.loading ? "opacity-60" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.customers && <Stat icon="users" href="/admin/customers" label={t("stats.customers")} value={d.customers.customers} note={t("stats.prospects", { count: d.customers.prospects })} />}
            {d.sales && (
              <Stat
                icon="chart"
                href="/admin/sales"
                label={t("stats.openDeals")}
                value={d.sales.open}
                note={d.sales.openValue.length ? d.sales.openValue.map((value) => format.money(value.amount, value.currency)).join(" · ") : t("stats.wonThisMonth", { count: d.sales.wonThisMonth })}
              />
            )}
            {d.tickets && <Stat icon="ticket" href="/admin/tickets" label={t("stats.activeTickets")} value={d.tickets.active} note={t("stats.urgentTickets", { count: d.tickets.urgent })} alert={d.tickets.urgent > 0} />}
            {d.tasks && <Stat icon="check" href="/admin/agenda" label={t("stats.pendingTasks")} value={d.tasks.pending} note={t("stats.overdue", { count: d.tasks.overdue })} alert={d.tasks.overdue > 0} />}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {d.tickets && (
              <Panel title={t("urgentTickets")} href="/admin/tickets" link={t("allTickets")}>
                {d.tickets.urgentList.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("noUrgentTickets")}</p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {d.tickets.urgentList.map((ticket) => (
                      <li key={ticket.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <Link href={`/admin/tickets/${ticket.id}`} className="min-w-0 text-sm font-semibold hover:text-brand-text">
                          <span className="mr-1.5 font-mono text-xs text-text-faint">#{ticket.number}</span>
                          {ticket.subject}
                          <span className="block truncate text-xs font-normal text-text-muted">{ticket.assignee?.name ?? t("unassigned")}</span>
                        </Link>
                        <span className="flex flex-none gap-1.5">
                          <Badge tone={TICKET_PRIORITY_TONE[ticket.priority]}>{tStatus(`priority.${ticket.priority}`)}</Badge>
                          <Badge tone={TICKET_STATUS_TONE[ticket.status]}>{tStatus(`ticket.${ticket.status}`)}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {d.tasks && (
              <Panel title={t("urgentTasks")} href="/admin/agenda" link={t("allTasks")}>
                {d.tasks.urgentList.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("noUrgentTasks")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {d.tasks.urgentList.map((task) => (
                      <li key={task.id}>
                        <TaskRow task={task} href={`/admin/agenda?task=${task.id}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {d.tasks && (
              <Panel title={t("upcoming")} href="/admin/agenda?tab=appointments" link={t("allAppointments")}>
                {d.tasks.upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("noUpcoming")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {d.tasks.upcomingAppointments.map((appointment) => (
                      <li key={appointment.id}>
                        <AppointmentRow appointment={appointment} href={`/admin/agenda?tab=appointments&appointment=${appointment.id}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {d.recentActivity && (
              <Panel title={t("recentActivity")}>
                {d.recentActivity.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("noActivity")}</p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {d.recentActivity.map((activity) => (
                      <li key={activity.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
                        <Link href={`/admin/customers/${activity.customer.id}`} className="font-semibold hover:text-brand-text">
                          {activity.customer.name}
                        </Link>
                        <span className="text-text-muted"> · {t(`activity.${activity.type}`)}</span>
                        <span className="block text-xs text-text-faint">
                          {format.dateTime(activity.createdAt)}
                          {activity.user ? ` · ${activity.user.name}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>

          {!d.customers && !d.sales && !d.tickets && !d.tasks && <EmptyState icon="lock" title={t("noAccess")} body={t("noAccessBody")} />}

          {platforms.data && platforms.data.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-lg font-bold">{t("platformsTitle")}</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {platforms.data.map((platform) => (
                  <li key={platform.id}>
                    <Link href={`/admin/p/${platform.slug}`} className="card card-hover flex h-full items-center gap-3 p-4">
                      <span className="h-3 w-3 flex-none rounded-full" style={{ background: platform.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-display font-bold">{platform.name}</span>
                      <span className="text-xs text-text-muted">{t("platformCounts", { customers: platform.customerCount, opportunities: platform.opportunityCount })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {platforms.data && platforms.data.length === 0 && isAdmin && (
            <div className="card">
              <EmptyState icon="globe" title={t("noPlatforms")} body={t("noPlatformsAdmin")} action={<Link href="/admin/settings/platforms" className="btn btn-primary btn-sm">{t("addPlatform")}</Link>} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Stat({ icon, href, label, value, note, alert = false }: { icon: IconName; href: string; label: string; value: number; note: string; alert?: boolean }) {
  return (
    <Link href={href} className="card card-hover flex items-start gap-4 p-5">
      <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${alert ? "bg-[rgb(var(--color-error-bg))] text-error" : "bg-surface-2 text-text-muted"}`}>
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-text-muted">{label}</span>
        <span className="block font-display text-2xl font-extrabold">{value}</span>
        <span className={`block truncate text-xs ${alert ? "font-semibold text-error" : "text-text-muted"}`}>{note}</span>
      </span>
    </Link>
  );
}

function Panel({ title, href, link, children }: { title: string; href?: string; link?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {href && link && (
          <Link href={href} className="text-sm font-semibold text-brand-text hover:underline">
            {link}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
