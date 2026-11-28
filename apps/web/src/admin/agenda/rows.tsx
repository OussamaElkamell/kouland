"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Appointment, Task } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat } from "@/admin/hooks";
import { APPOINTMENT_TONE } from "@/admin/labels";
import { Badge, PlatformChip } from "@/admin/ui";

/** One task: a checkbox to mark it done, its due date (red when overdue) and what it is about. */
export function TaskRow({ task, onToggle, onOpen, href, disabled }: { task: Task; onToggle?: () => void; onOpen?: () => void; href?: string; disabled?: boolean }) {
  const t = useTranslations("agenda");
  const format = useFormat();
  const done = task.status === "COMPLETED";
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={done}
        disabled={disabled || !onToggle}
        onChange={onToggle}
        aria-label={done ? t("markPending", { title: task.title }) : t("markDone", { title: task.title })}
        className="mt-1 h-4 w-4 flex-none accent-[rgb(var(--color-brand))]"
      />
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className={`text-sm font-semibold ${done ? "text-text-muted line-through" : "hover:text-brand-text"}`}>
            {task.title}
          </Link>
        ) : (
          <button type="button" onClick={onOpen} disabled={!onOpen} className={`text-left text-sm font-semibold ${done ? "text-text-muted line-through" : "hover:text-brand-text"}`}>
            {task.title}
          </button>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          {task.dueAt && (
            <span className={task.overdue ? "font-semibold text-error" : ""}>
              <Icon name="clock" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {task.overdue ? t("overdueSince", { date: format.dateTime(task.dueAt) }) : format.dateTime(task.dueAt)}
            </span>
          )}
          {task.priority === "HIGH" && !done && <Badge tone="warning">{t("priority.HIGH")}</Badge>}
          {task.assignee && <span>{task.assignee.name}</span>}
          {task.customer && (
            <Link href={`/admin/customers/${task.customer.id}`} className="hover:text-text">
              {task.customer.name}
            </Link>
          )}
          {task.ticket && (
            <Link href={`/admin/tickets/${task.ticket.id}`} className="hover:text-text">
              #{task.ticket.number}
            </Link>
          )}
          {task.opportunity && (
            <Link href={`/admin/sales/${task.opportunity.id}`} className="hover:text-text">
              {task.opportunity.name}
            </Link>
          )}
          {task.platform && <PlatformChip platform={task.platform} size="sm" />}
        </p>
      </div>
    </div>
  );
}

/** One appointment: day and time block, title, place and who goes. */
export function AppointmentRow({ appointment, onOpen, href }: { appointment: Appointment; onOpen?: () => void; href?: string }) {
  const t = useTranslations("agenda");
  const format = useFormat();
  const start = new Date(appointment.startsAt);
  return (
    <div className="flex items-start gap-3">
      <span className="flex w-14 flex-none flex-col items-center rounded-lg border bg-surface-2 py-1 text-center leading-tight">
        <span className="text-[0.65rem] font-bold uppercase text-text-muted">{format.month(appointment.startsAt)}</span>
        <span className="font-display text-lg font-extrabold">{start.getDate()}</span>
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="text-sm font-semibold hover:text-brand-text">
            {appointment.title}
          </Link>
        ) : (
          <button type="button" onClick={onOpen} disabled={!onOpen} className="text-left text-sm font-semibold hover:text-brand-text">
            {appointment.title}
          </button>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          <span>
            {format.dateTime(appointment.startsAt)} – {format.time(appointment.endsAt)}
          </span>
          {appointment.location && <span>{appointment.location}</span>}
          {appointment.assignee && <span>{appointment.assignee.name}</span>}
          {appointment.customer && (
            <Link href={`/admin/customers/${appointment.customer.id}`} className="hover:text-text">
              {appointment.customer.name}
            </Link>
          )}
          {appointment.status !== "SCHEDULED" && <Badge tone={APPOINTMENT_TONE[appointment.status]}>{t(`appointmentStatus.${appointment.status}`)}</Badge>}
        </p>
      </div>
    </div>
  );
}
