"use client";

import { useTranslations } from "next-intl";
import { CUSTOMER_STAGES, CUSTOMER_TYPES, type CustomerFieldsInput, type CustomerStage, type CustomerType } from "@kouland/contracts";
import { Field, Input, Textarea } from "@kouland/ui";
import { Select } from "@/admin/ui";

type TextField =
  | "firstName"
  | "lastName"
  | "companyName"
  | "email"
  | "phone"
  | "website"
  | "addressLine"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "notes";

/** Form values: every text field as a string so inputs stay controlled. */
export type CustomerFieldValues = { type: CustomerType; stage: CustomerStage } & Record<TextField, string>;

export const EMPTY_CUSTOMER: CustomerFieldValues = {
  type: "INDIVIDUAL",
  stage: "PROSPECT",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  website: "",
  addressLine: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  notes: "",
};

/**
 * The customer's own fields (person or company, contact details, address). Shared by the customer form and the
 * "new prospect" part of the opportunity form. `prefix` matches the API's error keys, e.g. `customer.` or `newCustomer.`.
 */
export function CustomerFields({
  value,
  onChange,
  errorFor,
  prefix,
  idPrefix = "c",
  showNotes = true,
}: {
  value: CustomerFieldValues;
  onChange: (value: CustomerFieldValues) => void;
  errorFor: (field: string) => string | undefined;
  prefix: string;
  idPrefix?: string;
  showNotes?: boolean;
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const set = <K extends keyof CustomerFieldValues>(key: K, next: CustomerFieldValues[K]) => onChange({ ...value, [key]: next });
  const error = (field: keyof CustomerFieldValues) => errorFor(`${prefix}${field}`);
  const text = (field: TextField, label: string, props: { type?: string; autoComplete?: string; optional?: boolean } = {}) => (
    <Field htmlFor={`${idPrefix}-${field}`} label={label} optionalLabel={props.optional === false ? undefined : tc("optional")} error={error(field)}>
      <Input
        id={`${idPrefix}-${field}`}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete ?? "off"}
        value={value[field]}
        onChange={(event) => set(field, event.target.value)}
        invalid={!!error(field)}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="field-label">{t("fields.type")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {CUSTOMER_TYPES.map((type) => (
            <label key={type} className={`card-select flex items-center gap-2 px-3 py-2.5 text-sm font-semibold ${value.type === type ? "selected" : ""}`}>
              <input type="radio" name={`${idPrefix}-type`} value={type} checked={value.type === type} onChange={() => set("type", type)} className="accent-[rgb(var(--color-brand))]" />
              {t(`type.${type}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {value.type === "COMPANY" ? (
          <div className="sm:col-span-2">{text("companyName", t("fields.companyName"), { optional: false, autoComplete: "organization" })}</div>
        ) : (
          <>
            {text("firstName", t("fields.firstName"), { optional: false })}
            {text("lastName", t("fields.lastName"))}
          </>
        )}
        {text("email", t("fields.email"), { type: "email" })}
        {text("phone", t("fields.phone"), { type: "tel" })}
        {text("website", t("fields.website"))}
        <Field htmlFor={`${idPrefix}-stage`} label={t("fields.stage")}>
          <Select id={`${idPrefix}-stage`} value={value.stage} onChange={(next) => set("stage", next as CustomerStage)}>
            {CUSTOMER_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {t(`stage.${stage}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <details className="group rounded-xl border px-4 py-3" open={Boolean(value.addressLine || value.city || value.country)}>
        <summary className="cursor-pointer text-sm font-semibold">{t("fields.address")}</summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("addressLine", t("fields.addressLine"))}</div>
          {text("city", t("fields.city"))}
          {text("region", t("fields.region"))}
          {text("postalCode", t("fields.postalCode"))}
          {text("country", t("fields.country"))}
        </div>
      </details>

      {showNotes && (
        <Field htmlFor={`${idPrefix}-notes`} label={t("fields.notes")} optionalLabel={tc("optional")} error={error("notes")}>
          <Textarea id={`${idPrefix}-notes`} rows={3} value={value.notes} onChange={(event) => set("notes", event.target.value)} invalid={!!error("notes")} />
        </Field>
      )}
    </div>
  );
}

/** Values sent to the API: only the fields that belong to the chosen type. */
export function toCustomerInput(value: CustomerFieldValues): CustomerFieldsInput {
  return {
    ...value,
    firstName: value.type === "INDIVIDUAL" ? value.firstName : "",
    lastName: value.type === "INDIVIDUAL" ? value.lastName : "",
    companyName: value.type === "COMPANY" ? value.companyName : "",
  };
}
