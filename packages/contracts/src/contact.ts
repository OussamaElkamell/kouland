import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Public contact form on the corporate website: POST /contact. */
export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  phone: optionalText(40),
  company: optionalText(160),
  subject: optionalText(160),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(5000),
});
/** What the form sends (before trimming). */
export type CreateContactMessageInput = z.input<typeof createContactMessageSchema>;
/** What the API stores (after validation). */
export type CreateContactMessage = z.output<typeof createContactMessageSchema>;

export const contactMessageReceiptSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
});
export type ContactMessageReceipt = z.infer<typeof contactMessageReceiptSchema>;
