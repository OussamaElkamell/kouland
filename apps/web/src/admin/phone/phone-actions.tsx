"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Call } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { useSubmit } from "@/admin/hooks";
import { useSession } from "@/admin/session";
import { FormError, Modal } from "@/admin/ui";
import { api } from "@/lib/api";

/**
 * "Call" and "Text" next to a customer's number. Calling rings the employee's own phone first, then connects the
 * customer showing the company number; nothing is dialled from the browser.
 */
export function PhoneActions({ customer, onDone }: { customer: { id: string; name: string; phone: string }; onDone: () => void }) {
  const t = useTranslations("phone");
  const tc = useTranslations("common");
  const { user } = useSession();
  const [open, setOpen] = useState<"call" | "sms" | null>(null);
  const [started, setStarted] = useState(false);
  const [body, setBody] = useState("");
  const action = useSubmit();

  function close() {
    setOpen(null);
    setStarted(false);
    action.setFormError(null);
  }

  async function call() {
    const done = await action.submit(() => api.calls.start({ customerId: customer.id, to: customer.phone }));
    if (done) {
      setStarted(true);
      onDone();
    }
  }

  async function sendSms(event: FormEvent) {
    event.preventDefault();
    const sent = await action.submit(() => api.sms.send({ customerId: customer.id, to: customer.phone, body }));
    if (sent) {
      setBody("");
      close();
      onDone();
    }
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen("call")}>
        <Icon name="phone" className="h-4 w-4" />
        {t("call")}
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen("sms")}>
        <Icon name="message" className="h-4 w-4" />
        {t("text")}
      </button>

      <Modal
        open={open === "call"}
        onClose={close}
        title={t("callTitle", { name: customer.name })}
        footer={
          started ? (
            <button type="button" className="btn btn-primary" onClick={close}>
              {tc("close")}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={close}>
                {tc("cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void call()} disabled={action.pending || !user.phone}>
                {action.pending ? tc("working") : t("callNow")}
              </button>
            </>
          )
        }
      >
        <FormError message={action.formError} />
        {started ? (
          <p className="text-sm">{t("ringing", { phone: user.phone ?? "" })}</p>
        ) : user.phone ? (
          <p className="text-sm">{t("callExplain", { me: user.phone, name: customer.name, phone: customer.phone })}</p>
        ) : (
          <p className="text-sm">
            {t("noPhone")}{" "}
            <Link href="/admin/account" className="font-semibold text-brand-text hover:underline">
              {t("addPhone")}
            </Link>
          </p>
        )}
      </Modal>

      <Modal
        open={open === "sms"}
        onClose={close}
        title={t("smsTitle", { name: customer.name })}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close}>
              {tc("cancel")}
            </button>
            <button type="submit" form="sms-form" className="btn btn-primary" disabled={action.pending || !body.trim()}>
              {action.pending ? tc("working") : t("send")}
            </button>
          </>
        }
      >
        <form id="sms-form" onSubmit={sendSms} className="flex flex-col gap-3" noValidate>
          <FormError message={action.formError} />
          <p className="text-sm text-text-muted">{t("smsTo", { phone: customer.phone })}</p>
          <Field htmlFor="sms-body" label={t("message")} hint={t("smsLength", { count: body.length })} error={action.errorFor("body")}>
            <Textarea id="sms-body" rows={5} maxLength={1600} value={body} onChange={(e) => setBody(e.target.value)} invalid={!!action.errorFor("body")} />
          </Field>
        </form>
      </Modal>
    </>
  );
}

/** Notes about a call, written by the person on it (or anyone who can edit customers). */
export function CallNotes({ call, onSaved }: { call: Pick<Call, "id" | "notes">; onSaved: (notes: string | null) => void }) {
  const t = useTranslations("phone");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(call.notes ?? "");
  const action = useSubmit();

  async function save(event: FormEvent) {
    event.preventDefault();
    const saved = await action.submit(() => api.calls.update(call.id, { notes }));
    if (saved) {
      onSaved(saved.notes);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-1">
        {call.notes && <p className="whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm">{call.notes}</p>}
        <button type="button" className="mt-1 text-xs font-semibold text-brand-text hover:underline" onClick={() => setEditing(true)}>
          {call.notes ? t("editNotes") : t("addNotes")}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="mt-2 flex flex-col gap-2" noValidate>
      <label htmlFor={`notes-${call.id}`} className="sr-only">
        {t("notes")}
      </label>
      <Textarea id={`notes-${call.id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} />
      <FormError message={action.formError} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
          {tc("cancel")}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={action.pending}>
          {action.pending ? tc("saving") : tc("save")}
        </button>
      </div>
    </form>
  );
}

/** "2:05" from seconds. */
export function duration(seconds: number | null): string {
  if (seconds === null) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PhoneInput(props: { id: string; value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return <Input id={props.id} type="tel" placeholder="+19185550123" value={props.value} onChange={(e) => props.onChange(e.target.value)} invalid={props.invalid} />;
}
