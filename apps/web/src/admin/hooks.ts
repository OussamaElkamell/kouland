"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@kouland/api-client";
import { INTL_LOCALE, toCrmLocale } from "./locale";

/** Loads data for a screen and reloads it when `deps` change. Errors are kept to show, not thrown. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const run = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    try {
      const result = await load();
      if (call === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (caught) {
      if (call === latest.current) setError(caught instanceof ApiError ? caught : new ApiError(500, String(caught)));
    } finally {
      if (call === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, loading, reload: run, setData };
}

/**
 * Form state for an API call: runs it, and turns the API's field error codes into sentences in the CRM language.
 * `errorFor("customer.email")` gives the message for one field.
 */
export function useSubmit() {
  const t = useTranslations("errors");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setPending(true);
      setFieldErrors({});
      setFormError(null);
      try {
        return await action();
      } catch (error) {
        if (error instanceof ApiError) {
          setFieldErrors(error.fieldErrors);
          setFormError(
            error.status === 0
              ? t("network")
              : error.status === 403
                ? t("forbidden")
                : error.status === 429
                  ? t("tooMany")
                  : Object.keys(error.fieldErrors).length > 0
                    ? t("checkFields")
                    : error.status >= 500
                      ? t("generic")
                      : error.message,
          );
        } else {
          setFormError(t("generic"));
        }
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [t],
  );

  const errorFor = useCallback(
    (field: string): string | undefined => {
      const code = fieldErrors[field]?.[0];
      if (!code) return undefined;
      return t.has(`field.${code}`) ? t(`field.${code}`) : t("field.invalid");
    },
    [fieldErrors, t],
  );

  return { submit, pending, formError, errorFor, setFormError };
}

/** Dates and money in the CRM language. */
export function useFormat() {
  const locale = INTL_LOCALE[toCrmLocale(useLocale())];
  return {
    date: (value: string | null | undefined) =>
      value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : undefined }).format(new Date(value)) : "—",
    dateTime: (value: string | null | undefined) =>
      value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—",
    money: (value: number | null | undefined, currency = "USD") =>
      value === null || value === undefined
        ? "—"
        : new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value),
  };
}
