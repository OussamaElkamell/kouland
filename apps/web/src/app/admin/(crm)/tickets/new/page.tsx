"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TICKET_PRIORITIES, type TicketPriority } from "@kouland/contracts";
import { Field, Input, Textarea } from "@kouland/ui";
import { useLoad, useSubmit } from "@/admin/hooks";
import { CustomerPicker } from "@/admin/sales/customer-picker";
import { useCan, useSession } from "@/admin/session";
import { FormError, LoadingRows, PageHeader, Select } from "@/admin/ui";
import { api } from "@/lib/api";

/** New ticket recorded by staff. `?customer=<id>` starts it for that customer. */
function NewTicketForm() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const { user } = useSession();
  const { can } = useCan();
  const customerId = useSearchParams().get("customer");
  const preset = useLoad(async () => (customerId ? api.customers.get(customerId) : null), [customerId]);
  const departments = useLoad(() => api.departments.list(), []);
  const people = useLoad(() => api.users.assignable("TICKETS"), []);
  const { submit, pending, formError, errorFor } = useSubmit();
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [values, setValues] = useState({
    subject: "",
    description: "",
    priority: "NORMAL" as TicketPriority,
    platformId: user.platforms.length === 1 ? (user.platforms[0]?.id ?? "") : "",
    departmentId: "",
    assigneeId: "",
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues({ ...values, [key]: value });

  if (customerId && preset.loading) return <LoadingRows />;
  const chosen = customer ?? (preset.data ? { id: preset.data.id, name: preset.data.displayName } : null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit(() =>
      api.tickets.create({
        ...values,
        customerId: chosen?.id ?? null,
        platformId: values.platformId || null,
        departmentId: values.departmentId || null,
        assigneeId: values.assigneeId || null,
      }),
    );
    if (result) router.push(`/admin/tickets/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <section className="card flex flex-col gap-5 p-5 sm:p-6">
        <Field htmlFor="subject" label={t("form.subject")} error={errorFor("subject")}>
          <Input id="subject" value={values.subject} onChange={(e) => set("subject", e.target.value)} invalid={!!errorFor("subject")} />
        </Field>
        <Field htmlFor="description" label={t("form.description")} hint={t("form.descriptionHint")} error={errorFor("description")}>
          <Textarea id="description" rows={6} value={values.description} onChange={(e) => set("description", e.target.value)} invalid={!!errorFor("description")} />
        </Field>
        {can("CUSTOMERS", "VIEW") && (
          <div>
            <p className="field-label">
              {t("form.customer")} <span className="font-normal text-text-muted">{tc("optional")}</span>
            </p>
            <CustomerPicker value={chosen} onChange={setCustomer} />
          </div>
        )}
      </section>
      <section className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field htmlFor="platformId" label={t("form.platform")} error={errorFor("platformId")}>
          <Select id="platformId" value={values.platformId} onChange={(value) => set("platformId", value)} invalid={!!errorFor("platformId")}>
            <option value="">{t("form.noPlatform")}</option>
            {user.platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="priority" label={t("form.priority")}>
          <Select id="priority" value={values.priority} onChange={(value) => set("priority", value as TicketPriority)}>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {tStatus(`priority.${priority}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="departmentId" label={t("form.department")} optionalLabel={tc("optional")} error={errorFor("departmentId")}>
          <Select id="departmentId" value={values.departmentId} onChange={(value) => set("departmentId", value)}>
            <option value="">{t("form.noDepartment")}</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="assigneeId" label={t("form.assignee")} optionalLabel={tc("optional")} error={errorFor("assigneeId")}>
          <Select id="assigneeId" value={values.assigneeId} onChange={(value) => set("assigneeId", value)} invalid={!!errorFor("assigneeId")}>
            <option value="">{t("unassigned")}</option>
            {(people.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {tc("cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? tc("saving") : t("create")}
        </button>
      </div>
    </form>
  );
}

export default function NewTicketPage() {
  const t = useTranslations("tickets");
  return (
    <>
      <PageHeader title={t("add")} back={{ href: "/admin/tickets", label: t("title") }} />
      <Suspense fallback={<LoadingRows />}>
        <NewTicketForm />
      </Suspense>
    </>
  );
}
