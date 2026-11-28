import { z } from "zod";
import { ERROR_CODES, optionalText, optionalUrl, text } from "./common";

/** "Kouland Host" → "kouland-host". */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(60, ERROR_CODES.tooLong)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, ERROR_CODES.slug);

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, ERROR_CODES.color)
  .transform((value) => value.toUpperCase());

const platformFields = {
  name: text(80),
  description: optionalText(500),
  websiteUrl: optionalUrl,
  color: colorSchema.default("#64748B"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
};

/** POST /platforms. The slug is made from the name when left empty. */
export const createPlatformSchema = z
  .object({ ...platformFields, slug: z.union([z.literal(""), slugSchema]).optional() })
  .transform(({ slug, ...rest }) => ({ ...rest, slug: slug || slugify(rest.name) }))
  .refine((value) => value.slug.length > 0, { path: ["slug"], message: ERROR_CODES.slug });
export type CreatePlatformInput = z.input<typeof createPlatformSchema>;

/** PATCH /platforms/:id. Deactivate with `isActive: false`; platforms are never deleted. */
export const updatePlatformSchema = z.object({
  name: platformFields.name.optional(),
  slug: slugSchema.optional(),
  // Outer optional(): a missing field stays undefined (unchanged); an empty one becomes null (cleared).
  description: platformFields.description.optional(),
  websiteUrl: platformFields.websiteUrl.optional(),
  color: colorSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});
export type UpdatePlatformInput = z.input<typeof updatePlatformSchema>;

export const platformSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  color: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  customerCount: z.number().int(),
  opportunityCount: z.number().int(),
  createdAt: z.string(),
});
export type Platform = z.infer<typeof platformSchema>;
