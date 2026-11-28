"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { OPPORTUNITY_SOURCES, OPPORTUNITY_STATUSES, type OpportunitySource, type OpportunityStatus } from "@kouland/contracts";
import { Field, Input, Textarea } from "@kouland/ui";
import { DateInput } from "@/components/date-input";
import { CustomerFields, EMPTY_CUSTOMER, toCustomerInput } from "@/admin/customers/customer-fields";
import { useLoad, useSubmit } from "@/admin/hooks";
import { useCan, useSession } from "@/admin/session";
import { FormError, Select } from "@/admin/ui";
import { api } from "@/lib/api";
import { CustomerPicker } from "./customer-picker";

export interface OpportunityValues {
  title: string;
  platformId: string;
  status: OpportunityStatus;
  source: OpportunitySource;
  request: string;
  estimatedValue: string;
  currency: string;
  expectedCloseDate: string;
  ownerId: string;
  lostReason: string;
}

/**
 * New opportunity (for an existing customer, or registering a new prospect at the same time), or editing one.
 * When editing, the customer is fixed.
 */
export function OpportunityForm({
  opportunityId,
  initial,
  initialCustomer = null,
}: {
  opportunityId?: string;
  initial?: OpportunityValues;
  initialCustomer?: { id: string; name: string } | null;
}) {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const { user } = useSession();
  const { can } = useCan();
  const { submit, pending, formError, errorFor } = useSubmit();
  const owners = useLoad(() => api.users.assignable(), []);
  const canSearch = can("CUSTOMERS", "VIEW");

  const [values, setValues] = useState<OpportunityValues>(
    initial ?? {
      title: "",
      platformId: user.platforms.length === 1 ? (user.platforms[0]?.id ?? "") : "",
      status: "NEW",
      source: "OTHER",
      request: "",
      estimatedValue: "",
      currency: "USD",
      expectedCloseDate: "",
      ownerId: user.access.SALES === "VIEW" ? "" : user.id,
      lostReason: "",
    },
  );
  const [mode, setMode] = useState<"existing" | "new">(initialCustomer || canSearch ? "existing" : "new");
  const [customer, setCustomer] = useState(initialCustomer);
  const [prospect, setProspect] = useState(EMPTY_CUSTOMER);
  const set = <K extends keyof OpportunityValues>(key: K, value: OpportunityValues[K]) => setValues({ ...values, [key]: value });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const fields = { ...values, ownerId: values.ownerId || null };
    const result = await submit(() =>
      opportunityId
        ? api.opportunities.update(opportunityId, fields)
        : api.opportunities.create({
            ...fields,
            ...(mode === "existing" ? { customerId: customer?.id ?? "" } : { newCustomer: toCustomerInput(prospect) }),
          }),
    );
    if (result) router.push(`/admin/sales/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />

      {!opportunityId && (
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{t("form.customer")}</h2>
            {canSearch && !initialCustomer && (
              <div className="flex rounded-full border p-1 text-sm" role="tablist">
                {(["existing", "new"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={mode === option}
                    className={`rounded-full px-3 py-1 font-semibold ${mode === option ? "bg-surface-2 text-text" : "text-text-muted"}`}
                    onClick={() => setMode(option)}
                  >
                    {t(`form.${option}Customer`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {mode === "existing" ? (
            <>
              <CustomerPicker value={customer} onChange={setCustomer} invalid={!!errorFor("customerId")} />
              {errorFor("customerId") && <p className="field-error">{errorFor("customerId")}</p>}
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-muted">{t("form.newProspectHint")}</p>
              <CustomerFields value={prospect} onChange={setProspect} errorFor={errorFor} prefix="newCustomer." idPrefix="p" showNotes={false} />
            </>
          )}
        </section>
      )}

      <section className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <Field htmlFor="title" label={t("form.title")} hint={t("form.titleHint")} error={errorFor("title")}>
            <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} invalid={!!errorFor("title")} />
          </Field>
        </div>
        <Field htmlFor="platformId" label={t("form.platform")} error={errorFor("platformId")}>
          <Select id="platformId" value={values.platformId} onChange={(value) => set("platformId", value)} invalid={!!errorFor("platformId")}>
            <option value="">{t("form.choosePlatform")}</option>
            {user.platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="source" label={t("form.source")}>
          <Select id="source" value={values.source} onChange={(value) => set("source", value as OpportunitySource)}>
            {OPPORTUNITY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(`source.${source}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="status" label={t("form.status")}>
          <Select id="status" value={values.status} onChange={(value) => set("status", value as OpportunityStatus)}>
            {OPPORTUNITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {tStatus(`opportunity.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="ownerId" label={t("form.owner")} optionalLabel={tc("optional")} error={errorFor("ownerId")}>
          <Select id="ownerId" value={values.ownerId} onChange={(value) => set("ownerId", value)} invalid={!!errorFor("ownerId")}>
            <option value="">{t("form.noOwner")}</option>
            {(owners.data ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field htmlFor="estimatedValue" label={t("form.value")} optionalLabel={tc("optional")} error={errorFor("estimatedValue")}>
            <Input
              id="estimatedValue"
              inputMode="decimal"
              value={values.estimatedValue}
              onChange={(e) => set("estimatedValue", e.target.value)}
              invalid={!!errorFor("estimatedValue")}
            />
          </Field>
          <Field htmlFor="currency" label={t("form.currency")} error={errorFor("currency")}>
            <Input id="currency" maxLength={3} value={values.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} invalid={!!errorFor("currency")} />
          </Field>
        </div>
        <Field htmlFor="expectedCloseDate" label={t("form.closeDate")} optionalLabel={tc("optional")} error={errorFor("expectedCloseDate")}>
          <DateInput id="expectedCloseDate" value={values.expectedCloseDate} onChange={(v) => set("expectedCloseDate", v)} invalid={!!errorFor("expectedCloseDate")} />
        </Field>
        <div className="sm:col-span-2">
          <Field htmlFor="request" label={t("form.request")} optionalLabel={tc("optional")} hint={t("form.requestHint")} error={errorFor("request")}>
            <Textarea id="request" rows={4} value={values.request} onChange={(e) => set("request", e.target.value)} invalid={!!errorFor("request")} />
          </Field>
        </div>
        {values.status === "LOST" && (
          <div className="sm:col-span-2">
            <Field htmlFor="lostReason" label={t("form.lostReason")} optionalLabel={tc("optional")} error={errorFor("lostReason")}>
              <Textarea id="lostReason" rows={2} value={values.lostReason} onChange={(e) => set("lostReason", e.target.value)} />
            </Field>
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {tc("cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? tc("saving") : opportunityId ? tc("save") : t("create")}
        </button>
      </div>
    </form>
  );
}
