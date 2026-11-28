"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Task, TaskPriority } from "@kouland/contracts";
import { Field, Input, Textarea } from "@kouland/ui";
import { DateInput } from "@/components/date-input";
import { fromLocalInput, toLocalInput } from "@/admin/datetime";
import { useLoad, useSubmit } from "@/admin/hooks";
import { CustomerPicker } from "@/admin/sales/customer-picker";
import { useCan, useSession } from "@/admin/session";
import { FormError, Modal, Select } from "@/admin/ui";
import { api } from "@/lib/api";

export interface TaskPreset {
  customer?: { id: string; name: string } | null;
  ticket?: { id: string; label: string } | null;
  opportunity?: { id: string; label: string } | null;
  platformId?: string | null;
}

/** Create or edit a task. Links (customer, ticket, opportunity) come from where it was opened. */
export function TaskModal({
  open,
  task,
  preset,
  onClose,
  onDelete,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  preset?: TaskPreset;
  onClose: () => void;
  /** Shown as a Delete button when editing (for people allowed to delete). */
  onDelete?: () => void;
  onSaved: (task: Task) => void;
}) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const { user } = useSession();
  const { can } = useCan();
  const people = useLoad(() => api.users.assignable("TASKS"), []);
  const { submit, pending, formError, errorFor } = useSubmit();
  const [values, setValues] = useState(empty());
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);

  function empty() {
    return { title: "", description: "", priority: "NORMAL" as TaskPriority, dueAt: "", remindAt: "", assigneeId: user.id, platformId: "" };
  }

  useEffect(() => {
    if (!open) return;
    if (task) {
      setValues({
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        dueAt: toLocalInput(task.dueAt),
        remindAt: toLocalInput(task.remindAt),
        assigneeId: task.assignee?.id ?? "",
        platformId: task.platform?.id ?? "",
      });
      setCustomer(task.customer);
    } else {
      setValues({ ...empty(), platformId: preset?.platformId ?? (user.platforms.length === 1 ? (user.platforms[0]?.id ?? "") : "") });
      setCustomer(preset?.customer ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues({ ...values, [key]: value });
  const ticket = task?.ticket ? { id: task.ticket.id, label: `#${task.ticket.number} ${task.ticket.subject}` } : (preset?.ticket ?? null);
  const opportunity = task?.opportunity ? { id: task.opportunity.id, label: task.opportunity.name } : (preset?.opportunity ?? null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: values.title,
      description: values.description,
      priority: values.priority,
      dueAt: fromLocalInput(values.dueAt),
      remindAt: fromLocalInput(values.remindAt),
      assigneeId: values.assigneeId || null,
      platformId: values.platformId || null,
      customerId: customer?.id ?? null,
      ticketId: ticket?.id ?? null,
      opportunityId: opportunity?.id ?? null,
    };
    const saved = await submit(() => (task ? api.tasks.update(task.id, input) : api.tasks.create(input)));
    if (saved) onSaved(saved);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? t("editTask") : t("newTask")}
      wide
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-danger-outline mr-auto" onClick={onDelete}>
              {tc("delete")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tc("cancel")}
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field htmlFor="task-title" label={t("fields.title")} error={errorFor("title")}>
          <Input id="task-title" value={values.title} onChange={(e) => set("title", e.target.value)} invalid={!!errorFor("title")} />
        </Field>
        <Field htmlFor="task-description" label={t("fields.description")} optionalLabel={tc("optional")}>
          <Textarea id="task-description" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="task-due" label={t("fields.dueAt")} optionalLabel={tc("optional")} error={errorFor("dueAt")}>
            <DateInput id="task-due" withTime value={values.dueAt} onChange={(v) => set("dueAt", v)} />
          </Field>
          <Field htmlFor="task-remind" label={t("fields.remindAt")} optionalLabel={tc("optional")} hint={t("fields.remindHint")} error={errorFor("remindAt")}>
            <DateInput id="task-remind" withTime value={values.remindAt} onChange={(v) => set("remindAt", v)} invalid={!!errorFor("remindAt")} />
          </Field>
          <Field htmlFor="task-assignee" label={t("fields.assignee")} error={errorFor("assigneeId")}>
            <Select id="task-assignee" value={values.assigneeId} onChange={(value) => set("assigneeId", value)} invalid={!!errorFor("assigneeId")}>
              <option value="">{t("nobody")}</option>
              {!(people.data ?? []).some((person) => person.id === user.id) && <option value={user.id}>{user.name}</option>}
              {(people.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="task-priority" label={t("fields.priority")}>
            <Select id="task-priority" value={values.priority} onChange={(value) => set("priority", value as TaskPriority)}>
              <option value="NORMAL">{t("priority.NORMAL")}</option>
              <option value="HIGH">{t("priority.HIGH")}</option>
            </Select>
          </Field>
          <Field htmlFor="task-platform" label={t("fields.platform")} optionalLabel={tc("optional")} error={errorFor("platformId")}>
            <Select id="task-platform" value={values.platformId} onChange={(value) => set("platformId", value)}>
              <option value="">{t("noPlatform")}</option>
              {user.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {can("CUSTOMERS", "VIEW") && (
          <div>
            <p className="field-label">
              {t("fields.customer")} <span className="font-normal text-text-muted">{tc("optional")}</span>
            </p>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
        )}
        {(ticket || opportunity) && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-muted">
            {ticket ? t("linkedTicket", { label: ticket.label }) : t("linkedOpportunity", { label: opportunity!.label })}
          </p>
        )}
      </form>
    </Modal>
  );
}
