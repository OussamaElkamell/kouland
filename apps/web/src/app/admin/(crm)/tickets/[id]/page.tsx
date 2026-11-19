"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketDetail, type TicketUpdate, type UpdateTicketInput } from "@kouland/contracts";
import { Icon, Textarea } from "@kouland/ui";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/admin/labels";
import { useCan } from "@/admin/session";
import { Badge, ConfirmDialog, DetailList, ErrorNotice, FormError, LoadingRows, PageHeader, PlatformChip, Select } from "@/admin/ui";
import { api } from "@/lib/api";

export default function TicketPage() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useCan();
  const ticket = useLoad(() => api.tickets.get(id), [id]);
  const departments = useLoad(() => api.departments.list(), []);
  const people = useLoad(() => api.users.assignable("TICKETS"), []);
  const change = useSubmit();
  const note = useSubmit();
  const removal = useSubmit();
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (ticket.error) {
    return (
      <>
        <PageHeader title={t("title")} back={{ href: "/admin/tickets", label: t("title") }} />
        <ErrorNotice message={ticket.error.status === 404 ? t("notFound") : ticket.error.message} onRetry={ticket.error.status === 404 ? undefined : ticket.reload} />
      </>
    );
  }
  if (!ticket.data) return <LoadingRows rows={6} />;
  const d: TicketDetail = ticket.data;
  const canEdit = can("TICKETS", "EDIT");

  async function save(input: UpdateTicketInput) {
    const done = await change.submit(() => api.tickets.update(id, input));
    if (done) await ticket.reload();
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const added = await note.submit(() => api.tickets.comment(id, comment));
    if (added) {
      setComment("");
      ticket.setData({ ...d, updates: [...d.updates, added] });
    }
  }

  async function remove() {
    const done = await removal.submit(async () => {
      await api.tickets.remove(id);
      return true;
    });
    if (done) router.replace("/admin/tickets");
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/tickets", label: t("title") }}
        title={
          <span>
            <span className="mr-2 font-mono text-lg text-text-faint">#{d.number}</span>
            {d.subject}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={TICKET_STATUS_TONE[d.status]}>{tStatus(`ticket.${d.status}`)}</Badge>
            <Badge tone={TICKET_PRIORITY_TONE[d.priority]}>{tStatus(`priority.${d.priority}`)}</Badge>
            {d.platform && <PlatformChip platform={d.platform} size="sm" />}
            {d.source === "WEBSITE" && <Badge tone="neutral">{t("fromWebsite")}</Badge>}
          </span>
        }
        actions={
          <>
            {can("TASKS", "EDIT") && (
              <Link href={`/admin/agenda?new=task&ticket=${d.id}`} className="btn btn-outline btn-sm">
                <Icon name="plus" className="h-4 w-4" />
                {t("addTask")}
              </Link>
            )}
            {can("TICKETS", "MANAGE") && (
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" className="h-4 w-4" />
                {tc("delete")}
              </button>
            )}
          </>
        }
      />
      {change.formError && <div className="mb-4"><ErrorNotice message={change.formError} /></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-2 font-display text-lg font-bold">{t("form.description")}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{d.description}</p>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{t("progress")}</h2>
            <ol className="relative flex flex-col gap-5 border-l pl-6">
              <li className="relative">
                <Dot icon="ticket" />
                <p className="text-sm font-semibold">{d.source === "WEBSITE" ? t("openedWebsite", { name: d.requesterName ?? "" }) : t("opened", { name: d.createdBy?.name ?? "" })}</p>
                <p className="mt-1 text-xs text-text-faint">{format.dateTime(d.createdAt)}</p>
              </li>
              {d.updates.map((update) => (
                <li key={update.id} className="relative">
                  <Dot icon={update.type === "COMMENT" ? "message" : "pencil"} />
                  <UpdateLine update={update} />
                  <p className="mt-1 text-xs text-text-faint">
                    {format.dateTime(update.createdAt)}
                    {update.user ? ` · ${update.user.name}` : ""}
                  </p>
                </li>
              ))}
            </ol>
            <form onSubmit={addComment} className="mt-6 flex flex-col gap-2" noValidate>
              <label htmlFor="ticket-comment" className="sr-only">
                {t("commentPlaceholder")}
              </label>
              <Textarea id="ticket-comment" rows={3} placeholder={t("commentPlaceholder")} value={comment} onChange={(e) => setComment(e.target.value)} />
              <FormError message={note.formError} />
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary btn-sm" disabled={note.pending || !comment.trim()}>
                  {note.pending ? tc("saving") : t("addComment")}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">{t("handling")}</h2>
            <label className="text-sm">
              <span className="field-label">{t("form.status")}</span>
              <Select id="ticket-status" value={d.status} disabled={!canEdit || change.pending} onChange={(value) => void save({ status: value as TicketDetail["status"] })}>
                {TICKET_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {tStatus(`ticket.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="field-label">{t("form.priority")}</span>
              <Select id="ticket-priority" value={d.priority} disabled={!canEdit || change.pending} onChange={(value) => void save({ priority: value as TicketDetail["priority"] })}>
                {TICKET_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {tStatus(`priority.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="field-label">{t("form.department")}</span>
              <Select id="ticket-department" value={d.department?.id ?? ""} disabled={!canEdit || change.pending} onChange={(value) => void save({ departmentId: value || null })}>
                <option value="">{t("form.noDepartment")}</option>
                {(departments.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="field-label">{t("form.assignee")}</span>
              <Select id="ticket-assignee" value={d.assignee?.id ?? ""} disabled={!canEdit || change.pending} onChange={(value) => void save({ assigneeId: value || null })}>
                <option value="">{t("unassigned")}</option>
                {(people.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
                {d.assignee && !(people.data ?? []).some((person) => person.id === d.assignee!.id) && <option value={d.assignee.id}>{d.assignee.name}</option>}
              </Select>
            </label>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">{t("reporter")}</h2>
            <DetailList
              items={[
                {
                  label: t("form.customer"),
                  value: d.customer && (
                    <Link href={`/admin/customers/${d.customer.id}`} className="font-semibold text-brand-text hover:underline">
                      {d.customer.name}
                    </Link>
                  ),
                },
                { label: t("requester"), value: d.requesterName },
                { label: t("email"), value: d.requesterEmail && <a href={`mailto:${d.requesterEmail}`} className="text-brand-text hover:underline">{d.requesterEmail}</a> },
                { label: t("phone"), value: d.requesterPhone && <a href={`tel:${d.requesterPhone}`}>{d.requesterPhone}</a> },
                { label: t("created"), value: format.dateTime(d.createdAt) },
                { label: t("resolved"), value: d.resolvedAt && format.dateTime(d.resolvedAt) },
              ]}
            />
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteTitle")}
        body={t("deleteBody", { number: d.number })}
        confirmLabel={tc("delete")}
        pending={removal.pending}
        error={removal.formError}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

function Dot({ icon }: { icon: "ticket" | "message" | "pencil" }) {
  return (
    <span className="absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full border bg-surface text-text-muted">
      <Icon name={icon} className="h-3.5 w-3.5" />
    </span>
  );
}

/** One line of the ticket's progress, worded in the CRM language. */
function UpdateLine({ update }: { update: TicketUpdate }) {
  const t = useTranslations("tickets.updates");
  const tStatus = useTranslations("status");
  const data = update.data ?? {};
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  if (update.type === "COMMENT") {
    return <p className="whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm">{update.body}</p>;
  }
  const text =
    update.type === "STATUS"
      ? t("STATUS", { to: tStatus(`ticket.${str(data.to) || "OPEN"}`) })
      : update.type === "PRIORITY"
        ? t("PRIORITY", { to: tStatus(`priority.${str(data.to) || "NORMAL"}`) })
        : update.type === "DEPARTMENT"
          ? str(data.to)
            ? t("DEPARTMENT", { to: str(data.to) })
            : t("DEPARTMENT_NONE")
          : str(data.to)
            ? t("ASSIGNED", { to: str(data.to) })
            : t("UNASSIGNED");
  return <p className="text-sm font-semibold">{text}</p>;
}
