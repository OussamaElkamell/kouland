"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CustomerSummary } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { api } from "@/lib/api";

/** Search box that finds an existing customer by name, email or phone. */
export function CustomerPicker({
  value,
  onChange,
  invalid,
}: {
  value: { id: string; name: string } | null;
  onChange: (value: { id: string; name: string } | null) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("sales.form");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api.customers
        .list({ q, pageSize: 8 })
        .then((page) => !cancelled && setResults(page.items))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-surface-2 px-4 py-3">
        <span className="font-semibold">{value.name}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
          {t("changeCustomer")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          id="customerId"
          type="search"
          className={`input !pl-9 ${invalid ? "has-error" : ""}`}
          placeholder={t("searchCustomer")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
      </div>
      {query.trim().length >= 2 && (
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border" role="listbox" aria-label={t("searchCustomer")}>
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2"
                onClick={() => onChange({ id: customer.id, name: customer.displayName })}
              >
                <span className="font-semibold">{customer.displayName}</span>
                <span className="truncate text-xs text-text-muted">{customer.email ?? customer.phone ?? ""}</span>
              </button>
            </li>
          ))}
          {!searching && results.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">{t("noCustomerFound")}</li>}
          {searching && results.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">{t("searching")}</li>}
        </ul>
      )}
    </div>
  );
}
