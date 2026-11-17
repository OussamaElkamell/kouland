import { z } from "zod";

/**
 * Job application ("Join our team"). The form has one step per schema below, in this order; the website keeps
 * the current step in the URL (`?step=profile`). The API validates the whole application with
 * `jobApplicationSchema`. Error messages are shown translated per field by the website, so the messages here are
 * only a fallback.
 */
export const APPLICATION_STEPS = ["profile", "role", "experience", "availability", "review"] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

export const APPLICATION_AREAS = ["host", "route", "bot", "event", "tech", "company"] as const;
export const EMPLOYMENT_TYPES = ["fullTime", "partTime", "contract", "internship"] as const;
export const WORK_MODES = ["onSite", "remote", "hybrid"] as const;
export const EXPERIENCE_LEVELS = ["lessThan1", "1to3", "3to5", "moreThan5"] as const;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^https?:\/\/\S+\.\S+/i.test(value), "Enter a full link starting with https://");

export const applicationProfileSchema = z.object({
  fullName: text(2, 120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: text(6, 40),
  city: text(2, 120),
  country: text(2, 120),
});

export const applicationRoleSchema = z.object({
  area: z.enum(APPLICATION_AREAS),
  position: text(2, 120),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  workMode: z.enum(WORK_MODES),
});

export const applicationExperienceSchema = z.object({
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  skills: text(2, 500),
  motivation: text(50, 3000),
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
});

/** `availableFrom` is a calendar date (YYYY-MM-DD) and may not be in the past. */
export const applicationAvailabilitySchema = z.object({
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => value >= new Date().toISOString().slice(0, 10), "Pick today or a later date"),
  salaryExpectation: optionalText(120),
  consent: z.literal(true),
});

/** Fields of each step, so the website can check one step at a time. */
export const APPLICATION_STEP_SCHEMAS = {
  profile: applicationProfileSchema,
  role: applicationRoleSchema,
  experience: applicationExperienceSchema,
  availability: applicationAvailabilitySchema,
} as const;

export const jobApplicationSchema = applicationProfileSchema
  .merge(applicationRoleSchema)
  .merge(applicationExperienceSchema)
  .merge(applicationAvailabilitySchema);
/** What the form sends (before trimming). */
export type JobApplicationInput = z.input<typeof jobApplicationSchema>;
/** What the API stores (after validation). */
export type JobApplication = z.output<typeof jobApplicationSchema>;

/** The CV: PDF or Word, up to 5 MB. Checked in the browser and again by the API (including the file's content). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
} as const;
export type CvMimeType = keyof typeof CV_TYPES;
export const CV_ACCEPT = Object.entries(CV_TYPES)
  .flatMap(([mime, extension]) => [mime, extension])
  .join(",");

/**
 * POST /careers/applications is multipart/form-data with three fields: `application` (the JSON of
 * JobApplicationInput), `cv` (the file) and `locale` (the website language, en, fr or es).
 */
export const APPLICATION_FORM_FIELDS = { application: "application", cv: "cv", locale: "locale" } as const;
export const applicationLocaleSchema = z.enum(["en", "fr", "es"]).catch("en");

export const jobApplicationReceiptSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
});
export type JobApplicationReceipt = z.infer<typeof jobApplicationReceiptSchema>;
