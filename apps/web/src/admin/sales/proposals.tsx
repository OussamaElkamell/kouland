"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PROPOSAL_STATUSES, type Proposal, type ProposalStatus } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { DateInput } from "@/admin/date-input";
import { useFormat, useSubmit } from "@/admin/hooks";
import { PROPOSAL_TONE } from "@/admin/labels";
import { Badge, ConfirmDialog, FormError, Modal, Select } from "@/admin/ui";
import { api } from "@/lib/api";

interface Values {
  title: string;
  amount: string;
  currency: string;
  status: ProposalStatus;
  validUntil: string;
  details: string;
}

/** Commercial proposals (quotes) made for an opportunity. */
export function Proposals({
  opportunityId,
  currency,
  proposals,
  canEdit,
  canDelete,
  onChange,
}: {
  opportunityId: string;
  currency: string;
  proposals: Proposal[];
  canEdit: boolean;
  canDelete: boolean;
  onChange: () => void;
}) {
  const t = useTranslations("proposals");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const form = useSubmit();
  const removal = useSubmit();
  const [editing, setEditing] = useState<Proposal | "new" | null>(null);
  const [removing, setRemoving] = useState<Proposal | null>(null);
  const [values, setValues] = useState<Values>({ title: "", amount: "", currency, status: "DRAFT", validUntil: "", details: "" });
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues({ ...values, [key]: value });

  function open(proposal: Proposal | "new") {
    setValues(
      proposal === "new"
        ? { title: "", amount: "", currency, status: "DRAFT", validUntil: "", details: "" }
        : {
            title: proposal.title,
            amount: String(proposal.amount),
            currency: proposal.currency,
            status: proposal.status,
            validUntil: proposal.validUntil ?? "",
            details: proposal.details ?? "",
          },
    );
    setEditing(proposal);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await form.submit(() =>
      editing === "new" ? api.opportunities.addProposal(opportunityId, values) : api.opportunities.updateProposal((editing as Proposal).id, values),
    );
    if (saved) {
      setEditing(null);
      onChange();
    }
  }

  async function onRemove() {
    if (!removing) return;
    const done = await removal.submit(async () => {
      await api.opportunities.removeProposal(removing.id);
      return true;
    });
    if (done) {
      setRemoving(null);
      onChange();
    }
  }

  return (
    <div>
      {proposals.length === 0 ? (
        <p className="text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {proposal.title}
                  <Badge tone={PROPOSAL_TONE[proposal.status]}>{tStatus(`proposal.${proposal.status}`)}</Badge>
                </p>
                <p className="mt-1 font-display text-lg font-extrabold">{format.money(proposal.amount, proposal.currency)}</p>
                <p className="text-xs text-text-muted">
                  {[
                    proposal.sentAt && t("sentOn", { date: format.date(proposal.sentAt) }),
                    proposal.validUntil && t("validUntil", { date: format.date(proposal.validUntil) }),
                    proposal.createdBy && t("by", { name: proposal.createdBy.name }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {proposal.details && <p className="mt-2 whitespace-pre-line text-sm text-text-muted">{proposal.details}</p>}
              </div>
              <div className="flex gap-1">
                {canEdit && (
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => open(proposal)} aria-label={t("editLabel", { title: proposal.title })}>
                    <Icon name="pencil" className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setRemoving(proposal)} aria-label={t("removeLabel", { title: proposal.title })}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
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
            <button type="submit" form="proposal-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </>
        }
      >
        <form id="proposal-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={form.formError} />
          <Field htmlFor="proposal-title" label={t("title")} error={form.errorFor("title")}>
            <Input id="proposal-title" value={values.title} onChange={(e) => set("title", e.target.value)} invalid={!!form.errorFor("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]">
            <Field htmlFor="proposal-amount" label={t("amount")} error={form.errorFor("amount")}>
              <Input id="proposal-amount" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} invalid={!!form.errorFor("amount")} />
            </Field>
            <Field htmlFor="proposal-currency" label={t("currency")} error={form.errorFor("currency")}>
              <Input id="proposal-currency" maxLength={3} value={values.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
            <Field htmlFor="proposal-status" label={t("status")}>
              <Select id="proposal-status" value={values.status} onChange={(value) => set("status", value as ProposalStatus)}>
                {PROPOSAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tStatus(`proposal.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field htmlFor="proposal-valid" label={t("validUntilLabel")} optionalLabel={tc("optional")} error={form.errorFor("validUntil")}>
            <DateInput id="proposal-valid" value={values.validUntil} onChange={(v) => set("validUntil", v)} />
          </Field>
          <Field htmlFor="proposal-details" label={t("details")} optionalLabel={tc("optional")} error={form.errorFor("details")}>
            <Textarea id="proposal-details" rows={4} value={values.details} onChange={(e) => set("details", e.target.value)} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        body={t("removeBody", { title: removing?.title ?? "" })}
        confirmLabel={t("remove")}
        pending={removal.pending}
        error={removal.formError}
        onConfirm={() => void onRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
