"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentStatus } from "@kouland/contracts";
import { Field, Input, Textarea } from "@kouland/ui";
import { DateInput } from "@/admin/date-input";
import { fromLocalInput, localInputIn, toLocalInput } from "@/admin/datetime";
import { useLoad, useSubmit } from "@/admin/hooks";
import { CustomerPicker } from "@/admin/sales/customer-picker";
import { useCan, useSession } from "@/admin/session";
import { FormError, Modal, Select } from "@/admin/ui";
import { api } from "@/lib/api";

/** Schedule or change an appointment. */
export function AppointmentModal({
  open,
  appointment,
  presetCustomer,
  onClose,
  onDelete,
  onSaved,
}: {
  open: boolean;
  appointment: Appointment | null;
  presetCustomer?: { id: string; name: string } | null;
  onClose: () => void;
  /** Shown as a Delete button when editing (for people allowed to delete). */
  onDelete?: () => void;
  onSaved: (appointment: Appointment) => void;
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
    const start = localInputIn(60);
    const end = toLocalInput(new Date(new Date(start).getTime() + 3_600_000).toISOString());
    return { title: "", description: "", location: "", startsAt: start, endsAt: end, remindAt: "", status: "SCHEDULED" as AppointmentStatus, assigneeId: user.id, platformId: "" };
  }

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setValues({
        title: appointment.title,
        description: appointment.description ?? "",
        location: appointment.location ?? "",
        startsAt: toLocalInput(appointment.startsAt),
        endsAt: toLocalInput(appointment.endsAt),
        remindAt: toLocalInput(appointment.remindAt),
        status: appointment.status,
        assigneeId: appointment.assignee?.id ?? "",
        platformId: appointment.platform?.id ?? "",
      });
      setCustomer(appointment.customer);
    } else {
      setValues({ ...empty(), platformId: user.platforms.length === 1 ? (user.platforms[0]?.id ?? "") : "" });
      setCustomer(presetCustomer ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment]);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues({ ...values, [key]: value });

  /** Moving the start keeps the same length. */
  function setStart(value: string) {
    const length = new Date(values.endsAt).getTime() - new Date(values.startsAt).getTime();
    const end = value && length > 0 ? toLocalInput(new Date(new Date(value).getTime() + length).toISOString()) : values.endsAt;
    setValues({ ...values, startsAt: value, endsAt: end });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: values.title,
      description: values.description,
      location: values.location,
      startsAt: fromLocalInput(values.startsAt) ?? "",
      endsAt: fromLocalInput(values.endsAt) ?? "",
      remindAt: fromLocalInput(values.remindAt),
      status: values.status,
      assigneeId: values.assigneeId || null,
      platformId: values.platformId || null,
      customerId: customer?.id ?? null,
    };
    const saved = await submit(() => (appointment ? api.appointments.update(appointment.id, input) : api.appointments.create(input)));
    if (saved) onSaved(saved);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={appointment ? t("editAppointment") : t("newAppointment")}
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
          <button type="submit" form="appointment-form" className="btn btn-primary" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </button>
        </>
      }
    >
      <form id="appointment-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field htmlFor="appt-title" label={t("fields.title")} error={errorFor("title")}>
          <Input id="appt-title" value={values.title} onChange={(e) => set("title", e.target.value)} invalid={!!errorFor("title")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="appt-start" label={t("fields.startsAt")} error={errorFor("startsAt")}>
            <DateInput id="appt-start" withTime value={values.startsAt} onChange={setStart} invalid={!!errorFor("startsAt")} />
          </Field>
          <Field htmlFor="appt-end" label={t("fields.endsAt")} error={errorFor("endsAt")}>
            <DateInput id="appt-end" withTime value={values.endsAt} onChange={(v) => set("endsAt", v)} invalid={!!errorFor("endsAt")} />
          </Field>
          <Field htmlFor="appt-location" label={t("fields.location")} optionalLabel={tc("optional")}>
            <Input id="appt-location" value={values.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field htmlFor="appt-remind" label={t("fields.remindAt")} optionalLabel={tc("optional")} error={errorFor("remindAt")}>
            <DateInput id="appt-remind" withTime value={values.remindAt} onChange={(v) => set("remindAt", v)} invalid={!!errorFor("remindAt")} />
          </Field>
          <Field htmlFor="appt-assignee" label={t("fields.assignee")} error={errorFor("assigneeId")}>
            <Select id="appt-assignee" value={values.assigneeId} onChange={(value) => set("assigneeId", value)} invalid={!!errorFor("assigneeId")}>
              <option value="">{t("nobody")}</option>
              {!(people.data ?? []).some((person) => person.id === user.id) && <option value={user.id}>{user.name}</option>}
              {(people.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="appt-platform" label={t("fields.platform")} optionalLabel={tc("optional")} error={errorFor("platformId")}>
            <Select id="appt-platform" value={values.platformId} onChange={(value) => set("platformId", value)}>
              <option value="">{t("noPlatform")}</option>
              {user.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </Select>
          </Field>
          {appointment && (
            <Field htmlFor="appt-status" label={t("fields.status")}>
              <Select id="appt-status" value={values.status} onChange={(value) => set("status", value as AppointmentStatus)}>
                {APPOINTMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`appointmentStatus.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field htmlFor="appt-description" label={t("fields.description")} optionalLabel={tc("optional")}>
          <Textarea id="appt-description" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        {can("CUSTOMERS", "VIEW") && (
          <div>
            <p className="field-label">
              {t("fields.customer")} <span className="font-normal text-text-muted">{tc("optional")}</span>
            </p>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
        )}
      </form>
    </Modal>
  );
}
