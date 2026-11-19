import { z } from "zod";

/**
 * Shared pieces of the CRM contracts.
 *
 * Validation messages in the CRM schemas are codes (see ERROR_CODES), not sentences: the CRM is in English,
 * French and Spanish, so the screen turns each code into a sentence in the user's language.
 */
export const ERROR_CODES = {
  required: "required",
  invalid: "invalid",
  email: "email",
  tooLong: "tooLong",
  tooShort: "tooShort",
  url: "url",
  color: "color",
  date: "date",
  slug: "slug",
  amount: "amount",
  passwordTooShort: "passwordTooShort",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const CRM_LOCALES = ["en", "fr", "es"] as const;
export const crmLocaleSchema = z.enum(CRM_LOCALES);
export type CrmLocale = z.infer<typeof crmLocaleSchema>;

export const idSchema = z.string().trim().min(1, ERROR_CODES.required).max(40, ERROR_CODES.invalid);

/** Required text: trimmed, not empty. */
export const text = (max: number) =>
  z
    .string({ required_error: ERROR_CODES.required, invalid_type_error: ERROR_CODES.invalid })
    .trim()
    .min(1, ERROR_CODES.required)
    .max(max, ERROR_CODES.tooLong);

/** Optional text: an empty string becomes null, so a form can clear a field. */
export const optionalText = (max: number) =>
  z
    .string({ invalid_type_error: ERROR_CODES.invalid })
    .trim()
    .max(max, ERROR_CODES.tooLong)
    .nullish()
    .transform((value) => (value ? value : null));

export const optionalEmail = z
  .string({ invalid_type_error: ERROR_CODES.invalid })
  .trim()
  .toLowerCase()
  .max(254, ERROR_CODES.tooLong)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, ERROR_CODES.email);

export const optionalUrl = z
  .string({ invalid_type_error: ERROR_CODES.invalid })
  .trim()
  .max(500, ERROR_CODES.tooLong)
  .nullish()
  .transform((value) => (value ? value : null))
  .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
  .refine((value) => value === null || z.string().url().safeParse(value).success, ERROR_CODES.url);

/** A calendar date as YYYY-MM-DD, or null. */
export const optionalDate = z
  .string({ invalid_type_error: ERROR_CODES.invalid })
  .trim()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), ERROR_CODES.date);

/** Money amount with 2 decimals at most, from a number or a form's text. */
export const amount = z
  .union([z.number(), z.string().trim().min(1, ERROR_CODES.required)], { invalid_type_error: ERROR_CODES.amount })
  .pipe(
    z.coerce
      .number({ invalid_type_error: ERROR_CODES.amount })
      .min(0, ERROR_CODES.amount)
      .max(9_999_999_999.99, ERROR_CODES.amount)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, ERROR_CODES.amount),
  );

export const optionalAmount = z
  .union([z.literal(""), z.null(), z.undefined(), amount])
  .transform((value) => (value === "" || value === undefined ? null : value));

/** ISO 4217 code. The CRM shows USD by default. */
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, ERROR_CODES.invalid)
  .default("USD");

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
};

export const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() });
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

/** A reference to another record, as shown in lists. */
export const refSchema = z.object({ id: z.string(), name: z.string() });
export type Ref = z.infer<typeof refSchema>;

export const platformRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), color: z.string() });
export type PlatformRef = z.infer<typeof platformRefSchema>;
