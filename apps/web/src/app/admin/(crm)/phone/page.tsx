"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CALL_FILTERS, type Call, type Sms } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { CallNotes, duration } from "@/admin/phone/phone-actions";
import { CustomerPicker } from "@/admin/sales/customer-picker";
import { useCan } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, LoadingRows, Modal, PageHeader, Pagination, type Tone } from "@/admin/ui";
import { api } from "@/lib/api";

const CALL_TONE: Record<Call["status"], Tone> = { RINGING: "info", COMPLETED: "success", MISSED: "error", FAILED: "neutral" };

/** Calls and SMS on the company number, with notes and the customer each one was with. */
export default function PhoneLogPage() {
  const t = useTranslations("phone");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "sms" ? "sms" : "calls";
  const filter = (CALL_FILTERS as readonly string[]).includes(params.get("filter") ?? "") ? (params.get("filter") as (typeof CALL_FILTERS)[number]) : "all";
  const [page, setPage] = useState(1);

  const go = (next: Record<string, string>) => {
    setPage(1);
    const target = next.tab ?? tab;
    router.replace(`/admin/phone?${new URLSearchParams({ tab: target, ...(target === "calls" ? { filter: next.filter ?? filter } : {}) })}`);
  };

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist">
          {(["calls", "sms"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`btn btn-sm ${tab === id ? "btn-primary" : "btn-ghost"}`} onClick={() => go({ tab: id })}>
              <Icon name={id === "calls" ? "phone" : "message"} className="h-4 w-4" />
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        {tab === "calls" && (
          <div className="ml-auto flex flex-wrap gap-1">
            {CALL_FILTERS.map((id) => (
              <button key={id} type="button" className={`btn btn-sm ${filter === id ? "btn-outline" : "btn-ghost"}`} onClick={() => go({ filter: id })}>
                {t(`filters.${id}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === "calls" ? <CallList filter={filter} page={page} onPage={setPage} /> : <SmsList page={page} onPage={setPage} />}
    </>
  );
}

function CallList({ filter, page, onPage }: { filter: (typeof CALL_FILTERS)[number]; page: number; onPage: (page: number) => void }) {
  const t = useTranslations("phone");
  const format = useFormat();
  const { can } = useCan();
  const list = useLoad(() => api.calls.list({ filter, page, pageSize: 25 }), [filter, page]);
  const [linking, setLinking] = useState<Call | null>(null);

  if (list.error) return <ErrorNotice message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <LoadingRows rows={6} />;
  if (list.data.items.length === 0) return <div className="card"><EmptyState icon="phone" title={t("noCalls")} body={t("noCallsBody")} /></div>;

  const replace = (call: Call) => list.setData({ ...list.data!, items: list.data!.items.map((c) => (c.id === call.id ? call : c)) });

  return (
    <>
      <ul className="card divide-y">
        {list.data.items.map((call) => {
          const other = call.direction === "INBOUND" ? call.fromNumber : call.toNumber;
          return (
            <li key={call.id} className="flex gap-4 px-5 py-4">
              <span className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border ${call.status === "MISSED" ? "text-error" : "text-text-muted"}`}>
                <Icon name="phone" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{call.customer ? <Link href={`/admin/customers/${call.customer.id}`} className="hover:text-brand-text">{call.customer.name}</Link> : other}</span>
                  {call.customer && <span className="text-text-muted">{other}</span>}
                  <Badge tone={CALL_TONE[call.status]}>{t(`status.${call.status}`)}</Badge>
                  <span className="text-xs text-text-muted">{t(`direction.${call.direction}`)}</span>
                </p>
                <p className="mt-0.5 text-xs text-text-faint">
                  {format.dateTime(call.startedAt)}
                  {call.durationSec !== null && call.status === "COMPLETED" ? ` · ${duration(call.durationSec)}` : ""}
                  {call.user ? ` · ${call.user.name}` : ""}
                </p>
                {!call.customer && can("CUSTOMERS", "EDIT") && (
                  <button type="button" className="mt-1 text-xs font-semibold text-brand-text hover:underline" onClick={() => setLinking(call)}>
                    {t("linkCustomer")}
                  </button>
                )}
                <CallNotes call={call} onSaved={(notes) => replace({ ...call, notes })} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={onPage} />
      </div>
      {linking && <LinkCustomer call={linking} onClose={() => setLinking(null)} onLinked={(call) => { replace(call); setLinking(null); }} />}
    </>
  );
}

/** Says which customer an unknown caller was. */
function LinkCustomer({ call, onClose, onLinked }: { call: Call; onClose: () => void; onLinked: (call: Call) => void }) {
  const t = useTranslations("phone");
  const tc = useTranslations("common");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const action = useSubmit();

  async function save() {
    if (!customer) return;
    const saved = await action.submit(() => api.calls.update(call.id, { customerId: customer.id }));
    if (saved) onLinked(saved);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("linkTitle", { phone: call.direction === "INBOUND" ? call.fromNumber : call.toNumber })}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tc("cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!customer || action.pending}>
            {action.pending ? tc("saving") : tc("save")}
          </button>
        </>
      }
    >
      {action.formError && <ErrorNotice message={action.formError} />}
      <CustomerPicker value={customer} onChange={setCustomer} />
    </Modal>
  );
}

function SmsList({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const t = useTranslations("phone");
  const format = useFormat();
  const list = useLoad(() => api.sms.list({ page, pageSize: 25 }), [page]);

  if (list.error) return <ErrorNotice message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <LoadingRows rows={6} />;
  if (list.data.items.length === 0) return <div className="card"><EmptyState icon="message" title={t("noSms")} body={t("noSmsBody")} /></div>;

  return (
    <>
      <ul className="card divide-y">
        {list.data.items.map((sms: Sms) => {
          const other = sms.direction === "INBOUND" ? sms.fromNumber : sms.toNumber;
          return (
            <li key={sms.id} className="px-5 py-4">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{sms.customer ? <Link href={`/admin/customers/${sms.customer.id}`} className="hover:text-brand-text">{sms.customer.name}</Link> : other}</span>
                {sms.customer && <span className="text-text-muted">{other}</span>}
                <span className="text-xs text-text-muted">{t(`smsDirection.${sms.direction}`)}</span>
                {sms.direction === "OUTBOUND" && <Badge tone={sms.status === "failed" || sms.status === "undelivered" ? "error" : sms.status === "delivered" ? "success" : "neutral"}>{t.has(`smsStatus.${sms.status}`) ? t(`smsStatus.${sms.status}`) : sms.status}</Badge>}
              </p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm">{sms.body}</p>
              <p className="mt-1 text-xs text-text-faint">
                {format.dateTime(sms.createdAt)}
                {sms.user ? ` · ${sms.user.name}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={onPage} />
      </div>
    </>
  );
}
