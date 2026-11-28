"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EmailMessage, EmailSummary } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { ErrorNotice, FormError, LoadingRows, Modal } from "@/admin/ui";
import { api } from "@/lib/api";

interface Draft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  replyToId?: string;
}

/**
 * Emails between the signed-in person's own mailbox and the customer's addresses, read live from Gmail or Outlook,
 * with Reply and New email. Each person only ever sees their own mailbox.
 */
export function CustomerEmails({ customerId, defaultTo, canSend, onSent }: { customerId: string; defaultTo: string | null; canSend: boolean; onSent: () => void }) {
  const t = useTranslations("email");
  const tc = useTranslations("common");
  const format = useFormat();
  const emails = useLoad(() => api.email.forCustomer(customerId), [customerId]);
  const [reading, setReading] = useState<EmailMessage | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const send = useSubmit();

  async function open(item: EmailSummary) {
    setLoadingId(item.id);
    setReadError(null);
    try {
      setReading(await api.email.message(item.id));
    } catch (error) {
      setReadError(error instanceof Error ? error.message : tc("close"));
    } finally {
      setLoadingId(null);
    }
  }

  function reply(message: EmailMessage) {
    const to = message.outgoing ? (message.to[0]?.email ?? "") : message.from.email;
    setReading(null);
    setDraft({ to, cc: "", subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, body: "", replyToId: message.id });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const done = await send.submit(async () => {
      await api.email.send(customerId, draft);
      return true;
    });
    if (done) {
      setDraft(null);
      onSent();
      void emails.reload();
    }
  }

  let content;
  if (emails.error) {
    content = emails.error.fieldErrors.mailbox ? (
      <p className="text-sm">
        {t("reconnect")}{" "}
        <Link href="/admin/account" className="font-semibold text-brand-text hover:underline">
          {t("goToAccount")}
        </Link>
      </p>
    ) : (
      <ErrorNotice message={emails.error.message} onRetry={emails.reload} />
    );
  } else if (!emails.data) {
    content = <LoadingRows rows={3} />;
  } else if (!emails.data.connected) {
    content = (
      <p className="text-sm text-text-muted">
        {t("notConnected")}{" "}
        <Link href="/admin/account" className="font-semibold text-brand-text hover:underline">
          {t("connectOnAccount")}
        </Link>
      </p>
    );
  } else if (emails.data.addresses.length === 0) {
    content = <p className="text-sm text-text-muted">{t("noAddress")}</p>;
  } else if (emails.data.items.length === 0) {
    content = <p className="text-sm text-text-muted">{t("none", { addresses: emails.data.addresses.join(", ") })}</p>;
  } else {
    content = (
      <ul className="-mx-2 flex flex-col">
        {emails.data.items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => void open(item)} className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2" disabled={loadingId !== null}>
              <Icon name={item.outgoing ? "arrow" : "mail"} className={`mt-0.5 h-4 w-4 flex-none ${item.outgoing ? "text-text-faint" : "text-brand-text"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{item.subject || t("noSubject")}</span>
                  <span className="flex-none text-xs text-text-faint">{format.dateTime(item.date)}</span>
                </span>
                <span className="block truncate text-xs text-text-muted">
                  {item.outgoing ? t("toLine", { to: item.to.map((a) => a.name || a.email).join(", ") }) : item.from.name || item.from.email} · {item.snippet}
                </span>
              </span>
              {loadingId === item.id && <span className="text-xs text-text-muted">…</span>}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        {canSend && emails.data?.connected && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft({ to: defaultTo ?? emails.data?.addresses[0] ?? "", cc: "", subject: "", body: "" })}>
            <Icon name="mail" className="h-4 w-4" />
            {t("new")}
          </button>
        )}
      </div>
      {readError && <ErrorNotice message={readError} />}
      {content}

      <Modal
        open={reading !== null}
        onClose={() => setReading(null)}
        title={reading?.subject || t("noSubject")}
        wide
        footer={
          reading && (
            <>
              {reading.webLink && (
                <a href={reading.webLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mr-auto">
                  {t("openInMailbox")}
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setReading(null)}>
                {tc("close")}
              </button>
              {canSend && (
                <button type="button" className="btn btn-primary" onClick={() => reply(reading)}>
                  {t("reply")}
                </button>
              )}
            </>
          )
        }
      >
        {reading && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <strong>{reading.from.name || reading.from.email}</strong> {reading.from.name && <span className="text-text-muted">&lt;{reading.from.email}&gt;</span>}
              <span className="block text-xs text-text-muted">
                {t("toLine", { to: reading.to.map((a) => a.email).join(", ") })}
                {reading.cc.length > 0 && ` · Cc: ${reading.cc.map((a) => a.email).join(", ")}`} · {format.dateTime(reading.date)}
              </span>
            </p>
            {reading.html ? (
              // The email's own HTML, isolated: no scripts, no access to the CRM page.
              <iframe title={reading.subject} sandbox="" srcDoc={reading.html} className="h-[55vh] w-full rounded-lg border bg-white" />
            ) : (
              <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-sans text-sm">{reading.text ?? reading.snippet}</pre>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.replyToId ? t("reply") : t("new")}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="email-form" className="btn btn-primary" disabled={send.pending}>
              {send.pending ? tc("working") : t("send")}
            </button>
          </>
        }
      >
        {draft && (
          <form id="email-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormError message={send.formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="email-to" label={t("to")} error={send.errorFor("to")}>
                <Input id="email-to" type="email" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} invalid={!!send.errorFor("to")} />
              </Field>
              <Field htmlFor="email-cc" label="Cc" optionalLabel={tc("optional")} error={send.errorFor("cc")}>
                <Input id="email-cc" value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} invalid={!!send.errorFor("cc")} />
              </Field>
            </div>
            <Field htmlFor="email-subject" label={t("subject")} error={send.errorFor("subject")}>
              <Input id="email-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} invalid={!!send.errorFor("subject")} />
            </Field>
            <Field htmlFor="email-body" label={t("message")} hint={draft.replyToId ? t("replyHint") : undefined} error={send.errorFor("body")}>
              <Textarea id="email-body" rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} invalid={!!send.errorFor("body")} />
            </Field>
          </form>
        )}
      </Modal>
    </section>
  );
}
