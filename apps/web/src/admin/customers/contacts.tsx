"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Contact } from "@kouland/contracts";
import { Field, Icon, Input } from "@kouland/ui";
import { useSubmit } from "@/admin/hooks";
import { Badge, ConfirmDialog, FormError, Modal } from "@/admin/ui";
import { api } from "@/lib/api";

const EMPTY = { firstName: "", lastName: "", jobTitle: "", email: "", phone: "", isPrimary: false };

/** The people at a company customer: add, edit, remove. */
export function Contacts({
  customerId,
  contacts,
  canEdit,
  onChange,
}: {
  customerId: string;
  contacts: Contact[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [values, setValues] = useState(EMPTY);
  const form = useSubmit();
  const removal = useSubmit();

  function open(contact: Contact | "new") {
    setValues(
      contact === "new"
        ? EMPTY
        : {
            firstName: contact.firstName,
            lastName: contact.lastName ?? "",
            jobTitle: contact.jobTitle ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            isPrimary: contact.isPrimary,
          },
    );
    setEditing(contact);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await form.submit(() =>
      editing === "new" ? api.customers.addContact(customerId, values) : api.customers.updateContact(customerId, (editing as Contact).id, values),
    );
    if (saved) {
      setEditing(null);
      onChange();
    }
  }

  async function onRemove() {
    if (!removing) return;
    const done = await removal.submit(async () => {
      await api.customers.removeContact(customerId, removing.id);
      return true;
    });
    if (done) {
      setRemoving(null);
      onChange();
    }
  }

  const input = (field: "firstName" | "lastName" | "jobTitle" | "email" | "phone", type = "text", optional = true) => (
    <Field htmlFor={`contact-${field}`} label={t(field)} optionalLabel={optional ? tc("optional") : undefined} error={form.errorFor(field)}>
      <Input id={`contact-${field}`} type={type} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} invalid={!!form.errorFor(field)} />
    </Field>
  );

  return (
    <div>
      {contacts.length === 0 ? (
        <p className="text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                  {contact.isPrimary && <Badge tone="brand">{t("primary")}</Badge>}
                </p>
                {contact.jobTitle && <p className="text-sm text-text-muted">{contact.jobTitle}</p>}
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-brand-text hover:underline">
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  )}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => open(contact)} aria-label={t("editLabel", { name: contact.firstName })}>
                    <Icon name="pencil" className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setRemoving(contact)} aria-label={t("removeLabel", { name: contact.firstName })}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => open("new")}>
          <Icon name="plus" className="h-4 w-4" />
          {t("add")}
        </button>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("add") : t("edit")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="contact-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </>
        }
      >
        <form id="contact-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={form.formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            {input("firstName", "text", false)}
            {input("lastName")}
            <div className="sm:col-span-2">{input("jobTitle")}</div>
            {input("email", "email")}
            {input("phone", "tel")}
          </div>
          <label className="checkbox-row text-sm">
            <input type="checkbox" checked={values.isPrimary} onChange={(e) => setValues({ ...values, isPrimary: e.target.checked })} />
            {t("makePrimary")}
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        body={t("removeBody", { name: removing ? [removing.firstName, removing.lastName].filter(Boolean).join(" ") : "" })}
        confirmLabel={t("remove")}
        pending={removal.pending}
        error={removal.formError}
        onConfirm={() => void onRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
