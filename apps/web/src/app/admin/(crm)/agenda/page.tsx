"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Appointment, Task } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { AppointmentModal } from "@/admin/agenda/appointment-modal";
import { AppointmentRow, TaskRow } from "@/admin/agenda/rows";
import { TaskModal, type TaskPreset } from "@/admin/agenda/task-modal";
import { useLoad, useSubmit } from "@/admin/hooks";
import { useCan } from "@/admin/session";
import { ConfirmDialog, EmptyState, ErrorNotice, LoadingRows, PageHeader, Pagination } from "@/admin/ui";
import { api } from "@/lib/api";

type Tab = "tasks" | "appointments";
type TaskView = "mine" | "all" | "overdue" | "completed";
const PAGE_SIZE = 30;

/**
 * Tasks and appointments. Addresses from notifications and other pages:
 * ?task=<id>, ?tab=appointments&appointment=<id>, ?new=task&ticket=<id>|customer=<id>, ?new=appointment&customer=<id>.
 */
function Agenda() {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useCan();
  const canEdit = can("TASKS", "EDIT");
  const [tab, setTab] = useState<Tab>(params.get("tab") === "appointments" || params.get("new") === "appointment" ? "appointments" : "tasks");
  const [view, setView] = useState<TaskView>("mine");
  const [mineOnly, setMineOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [editingTask, setEditingTask] = useState<Task | "new" | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | "new" | null>(null);
  const [removing, setRemoving] = useState<{ kind: "task" | "appointment"; id: string; title: string } | null>(null);
  const [preset, setPreset] = useState<TaskPreset>({});
  const toggle = useSubmit();
  const removal = useSubmit();

  useEffect(() => setPage(1), [tab, view, mineOnly]);

  const tasks = useLoad(
    () =>
      tab === "tasks"
        ? api.tasks.list({
            assigneeId: view === "mine" ? "me" : undefined,
            status: view === "completed" ? "COMPLETED" : view === "all" ? undefined : "PENDING",
            overdue: view === "overdue" ? "1" : undefined,
            page,
            pageSize: PAGE_SIZE,
          })
        : Promise.resolve(null),
    [tab, view, page],
  );
  const appointments = useLoad(
    () => (tab === "appointments" ? api.appointments.list({ assigneeId: mineOnly ? "me" : undefined, page, pageSize: PAGE_SIZE }) : Promise.resolve(null)),
    [tab, mineOnly, page],
  );

  // Open what the address asks for (once).
  useEffect(() => {
    const wanted = params.get("new");
    const ticketId = params.get("ticket");
    const customerId = params.get("customer");
    if (wanted === "task" && canEdit) {
      void (async () => {
        const next: TaskPreset = {};
        if (ticketId) {
          const ticket = await api.tickets.get(ticketId).catch(() => null);
          if (ticket) {
            next.ticket = { id: ticket.id, label: `#${ticket.number} ${ticket.subject}` };
            next.customer = ticket.customer;
            next.platformId = ticket.platform?.id ?? null;
          }
        }
        if (customerId) {
          const customer = await api.customers.get(customerId).catch(() => null);
          if (customer) next.customer = { id: customer.id, name: customer.displayName };
        }
        setPreset(next);
        setEditingTask("new");
      })();
    }
    if (wanted === "appointment" && canEdit) {
      void (async () => {
        if (customerId) {
          const customer = await api.customers.get(customerId).catch(() => null);
          if (customer) setPreset({ customer: { id: customer.id, name: customer.displayName } });
        }
        setEditingAppt("new");
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = params.get("task");
    const found = id && tasks.data?.items.find((task) => task.id === id);
    if (found) setEditingTask(found);
    else if (id && tasks.data && view !== "all") setView("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.data]);
  useEffect(() => {
    const id = params.get("appointment");
    const found = id && appointments.data?.items.find((item) => item.id === id);
    if (found) setEditingAppt(found);
    else if (id && appointments.data && mineOnly) setMineOnly(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.data]);

  function clearAddress() {
    if (params.toString()) router.replace("/admin/agenda");
  }

  async function toggleTask(task: Task) {
    const updated = await toggle.submit(() => api.tasks.setStatus(task.id, task.status === "COMPLETED" ? "PENDING" : "COMPLETED"));
    if (updated) await tasks.reload();
  }

  async function remove() {
    if (!removing) return;
    const done = await removal.submit(async () => {
      if (removing.kind === "task") await api.tasks.remove(removing.id);
      else await api.appointments.remove(removing.id);
      return true;
    });
    if (done) {
      setRemoving(null);
      await (removing.kind === "task" ? tasks.reload() : appointments.reload());
    }
  }

  const taskViews: TaskView[] = ["mine", "all", "overdue", "completed"];
  const current = tab === "tasks" ? tasks : appointments;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          canEdit && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setPreset({});
                  setEditingTask("new");
                }}
              >
                <Icon name="plus" className="h-4 w-4" />
                {t("newTask")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPreset({});
                  setEditingAppt("new");
                }}
              >
                <Icon name="calendar" className="h-4 w-4" />
                {t("newAppointment")}
              </button>
            </>
          )
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 pt-2">
          <div className="flex gap-1" role="tablist">
            {(["tasks", "appointments"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? "border-brand text-text" : "border-transparent text-text-muted hover:text-text"}`}
              >
                {t(`tabs.${item}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 pb-2">
            {tab === "tasks"
              ? taskViews.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setView(item)}
                    aria-pressed={view === item}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${view === item ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"}`}
                  >
                    {t(`views.${item}`)}
                  </button>
                ))
              : ([true, false] as const).map((mine) => (
                  <button
                    key={String(mine)}
                    type="button"
                    onClick={() => setMineOnly(mine)}
                    aria-pressed={mineOnly === mine}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${mineOnly === mine ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"}`}
                  >
                    {mine ? t("views.mine") : t("views.all")}
                  </button>
                ))}
          </div>
        </div>
        {toggle.formError && <div className="p-4"><ErrorNotice message={toggle.formError} /></div>}

        {current.error ? (
          <div className="p-4">
            <ErrorNotice message={current.error.message} onRetry={current.reload} />
          </div>
        ) : !current.data ? (
          <LoadingRows />
        ) : tab === "tasks" && tasks.data ? (
          tasks.data.items.length === 0 ? (
            <EmptyState icon="check" title={t("noTasks")} body={t(`noTasksBody.${view}`)} />
          ) : (
            <>
              <ul className="divide-y">
                {tasks.data.items.map((task) => (
                  <li key={task.id} className="px-5 py-3.5">
                    <TaskRow task={task} disabled={!canEdit || toggle.pending} onToggle={canEdit ? () => void toggleTask(task) : undefined} onOpen={canEdit ? () => setEditingTask(task) : undefined} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={PAGE_SIZE} total={tasks.data.total} onPage={setPage} />
            </>
          )
        ) : appointments.data && appointments.data.items.length === 0 ? (
          <EmptyState icon="calendar" title={t("noAppointments")} body={t("noAppointmentsBody")} />
        ) : appointments.data ? (
          <>
            <ul className="divide-y">
              {appointments.data.items.map((appointment) => (
                <li key={appointment.id} className="px-5 py-3.5">
                  <AppointmentRow appointment={appointment} onOpen={canEdit ? () => setEditingAppt(appointment) : undefined} />
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={appointments.data.total} onPage={setPage} />
          </>
        ) : null}
      </div>

      <TaskModal
        open={editingTask !== null}
        task={editingTask === "new" ? null : editingTask}
        preset={preset}
        onDelete={
          editingTask && editingTask !== "new" && can("TASKS", "MANAGE")
            ? () => {
                setRemoving({ kind: "task", id: editingTask.id, title: editingTask.title });
                setEditingTask(null);
              }
            : undefined
        }
        onClose={() => {
          setEditingTask(null);
          clearAddress();
        }}
        onSaved={() => {
          setEditingTask(null);
          clearAddress();
          void tasks.reload();
        }}
      />
      <AppointmentModal
        open={editingAppt !== null}
        appointment={editingAppt === "new" ? null : editingAppt}
        presetCustomer={preset.customer}
        onDelete={
          editingAppt && editingAppt !== "new" && can("TASKS", "MANAGE")
            ? () => {
                setRemoving({ kind: "appointment", id: editingAppt.id, title: editingAppt.title });
                setEditingAppt(null);
              }
            : undefined
        }
        onClose={() => {
          setEditingAppt(null);
          clearAddress();
        }}
        onSaved={() => {
          setEditingAppt(null);
          clearAddress();
          void appointments.reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing?.kind === "task" ? t("deleteTaskTitle") : t("deleteAppointmentTitle")}
        body={t("deleteBody", { title: removing?.title ?? "" })}
        confirmLabel={tc("delete")}
        pending={removal.pending}
        error={removal.formError}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Agenda />
    </Suspense>
  );
}
