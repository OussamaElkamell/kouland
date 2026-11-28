"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Department } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { useLoad, useSubmit } from "@/admin/hooks";
import { useCan } from "@/admin/session";
import { Badge, ErrorNotice, FormError, LoadingRows, Modal, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

const EMPTY = { name: "", description: "", sortOrder: "0", isActive: true };

/** Administrators manage the departments tickets are assigned to. */
export default function DepartmentSettingsPage() {
  const t = useTranslations("departments");
  const tc = useTranslations("common");
  const { isAdmin } = useCan();
  const departments = useLoad(() => api.departments.list(true), []);
  const form = useSubmit();
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [values, setValues] = useState(EMPTY);

  if (!isAdmin) return <ErrorNotice message={t("adminOnly")} />;

  function open(department: Department | "new") {
    setValues(
      department === "new"
        ? { ...EMPTY, sortOrder: String((departments.data?.length ?? 0) * 10) }
        : { name: department.name, description: department.description ?? "", sortOrder: String(department.sortOrder), isActive: department.isActive },
    );
    setEditing(department);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { ...values, sortOrder: Number(values.sortOrder) || 0 };
    const saved = await form.submit(() => (editing === "new" ? api.departments.create(input) : api.departments.update((editing as Department).id, input)));
    if (saved) {
      setEditing(null);
      await departments.reload();
    }
  }

  async function toggle(department: Department) {
    const saved = await form.submit(() =>
      api.departments.update(department.id, { name: department.name, description: department.description, sortOrder: department.sortOrder, isActive: !department.isActive }),
    );
    if (saved) await departments.reload();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open("new")}>
            <Icon name="plus" className="h-4 w-4" />
            {t("add")}
          </button>
        }
      />
      {form.formError && !editing && <div className="mb-4"><ErrorNotice message={form.formError} /></div>}
      <div className="card overflow-hidden">
        {departments.error ? (
          <div className="p-4">
            <ErrorNotice message={departments.error.message} onRetry={departments.reload} />
          </div>
        ) : !departments.data ? (
          <LoadingRows rows={3} />
        ) : (
          <ul className="divide-y">
            {departments.data.map((department) => (
              <li key={department.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${department.isActive ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {department.name}
                    {!department.isActive && <Badge>{t("inactive")}</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {department.description ? `${department.description} · ` : ""}
                    {t("openTickets", { count: department.openTickets })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => open(department)}>
                    <Icon name="pencil" className="h-4 w-4" />
                    {tc("edit")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggle(department)} disabled={form.pending}>
                    {department.isActive ? t("deactivate") : t("activate")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("add") : t("edit")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="department-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </>
        }
      >
        <form id="department-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={form.formError} />
          <Field htmlFor="department-name" label={t("name")} error={form.errorFor("name")}>
            <Input id="department-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} invalid={!!form.errorFor("name")} />
          </Field>
          <Field htmlFor="department-description" label={t("description")} optionalLabel={tc("optional")}>
            <Textarea id="department-description" rows={2} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} />
          </Field>
          <Field htmlFor="department-order" label={t("sortOrder")}>
            <Input id="department-order" type="number" min={0} value={values.sortOrder} onChange={(e) => setValues({ ...values, sortOrder: e.target.value })} />
          </Field>
          <label className="checkbox-row text-sm">
            <input type="checkbox" checked={values.isActive} onChange={(e) => setValues({ ...values, isActive: e.target.checked })} />
            {t("active")}
          </label>
        </form>
      </Modal>
    </>
  );
}
