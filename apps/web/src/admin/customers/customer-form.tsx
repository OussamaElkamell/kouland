"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSubmit } from "@/admin/hooks";
import { PlatformPicker } from "@/admin/platform-picker";
import { useSession } from "@/admin/session";
import { FormError } from "@/admin/ui";
import { api } from "@/lib/api";
import { CustomerFields, EMPTY_CUSTOMER, toCustomerInput, type CustomerFieldValues } from "./customer-fields";

/** Create or edit a customer with the platforms (services) they use. */
export function CustomerForm({
  customerId,
  initial = EMPTY_CUSTOMER,
  initialPlatformIds = [],
}: {
  customerId?: string;
  initial?: CustomerFieldValues;
  initialPlatformIds?: string[];
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user } = useSession();
  const { submit, pending, formError, errorFor } = useSubmit();
  const [fields, setFields] = useState(initial);
  const [platformIds, setPlatformIds] = useState(initialPlatformIds);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { customer: toCustomerInput(fields), platformIds };
    const result = await submit(() => (customerId ? api.customers.update(customerId, input) : api.customers.create(input)));
    if (result) router.push(`/admin/customers/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <section className="card p-5 sm:p-6">
        <CustomerFields value={fields} onChange={setFields} errorFor={errorFor} prefix="customer." />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">{t("fields.platforms")}</h2>
        <p className="mb-4 mt-1 text-sm text-text-muted">{t("platformsHint")}</p>
        {user.platforms.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noPlatforms")}</p>
        ) : (
          <PlatformPicker id="customer-platforms" platforms={user.platforms} value={platformIds} onChange={setPlatformIds} />
        )}
        {errorFor("platformIds") && <p className="field-error">{errorFor("platformIds")}</p>}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {tc("cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? tc("saving") : customerId ? tc("save") : t("create")}
        </button>
      </div>
    </form>
  );
}
