import {
  APPLICATION_STEP_SCHEMAS,
  APPLICATION_STEPS,
  type ApplicationStep,
  type JobApplicationInput,
} from "@kouland/contracts";

/** Form values while the applicant fills in the steps: every field as typed (strings), plus the consent box. */
export type ApplicationValues = { [K in Exclude<keyof JobApplicationInput, "consent">]-?: string } & { consent: boolean };
export type ApplicationField = keyof ApplicationValues;

export const EMPTY_APPLICATION: ApplicationValues = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  area: "",
  position: "",
  employmentType: "",
  workMode: "",
  experienceLevel: "",
  skills: "",
  motivation: "",
  linkedinUrl: "",
  portfolioUrl: "",
  availableFrom: "",
  salaryExpectation: "",
  consent: false,
};

/** Steps that hold fields (all but the final review). */
export type FormStep = Exclude<ApplicationStep, "review">;

/** Fields that belong to each step, in display order. */
export const STEP_FIELDS: Record<FormStep, ApplicationField[]> = {
  profile: ["fullName", "email", "phone", "city", "country"],
  role: ["area", "position", "employmentType", "workMode"],
  experience: ["experienceLevel", "skills", "motivation", "linkedinUrl", "portfolioUrl"],
  availability: ["availableFrom", "salaryExpectation", "consent"],
};

/** Reads `?step=` from the URL; anything unknown means the first step. `done` is the confirmation screen. */
export function parseStep(value: string | null): ApplicationStep | "done" {
  if (value === "done") return "done";
  return (APPLICATION_STEPS as readonly string[]).includes(value ?? "") ? (value as ApplicationStep) : "profile";
}

/** Invalid fields of one step, checked with the same rules as the API. */
export function invalidFieldsOf(step: FormStep, values: ApplicationValues): ApplicationField[] {
  const result = APPLICATION_STEP_SCHEMAS[step].safeParse(values);
  if (result.success) return [];
  const fields = Object.keys(result.error.flatten().fieldErrors) as ApplicationField[];
  return STEP_FIELDS[step].filter((field) => fields.includes(field));
}

/** The first step that still has an invalid field, or null when the whole form is valid. */
export function firstIncompleteStep(values: ApplicationValues): FormStep | null {
  for (const step of Object.keys(STEP_FIELDS) as FormStep[]) {
    if (invalidFieldsOf(step, values).length > 0) return step;
  }
  return null;
}

/** The step that holds a field, used to send the applicant back to it when the API refuses it. */
export function stepOfField(field: string): FormStep | null {
  for (const step of Object.keys(STEP_FIELDS) as FormStep[]) {
    if ((STEP_FIELDS[step] as string[]).includes(field)) return step;
  }
  return field === "cv" ? "experience" : null;
}

/**
 * The typed answers are kept in this tab's session storage, so a reload or the browser's back button does not
 * lose them. The CV file cannot be stored this way: after a reload the applicant attaches it again.
 */
const DRAFT_KEY = "kouland_job_application";

export function loadDraft(): ApplicationValues {
  try {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    if (!saved) return EMPTY_APPLICATION;
    const parsed = JSON.parse(saved) as Partial<ApplicationValues>;
    return { ...EMPTY_APPLICATION, ...parsed, consent: parsed.consent === true };
  } catch {
    return EMPTY_APPLICATION;
  }
}

export function saveDraft(values: ApplicationValues): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    /* storage unavailable (private mode): the form still works, the draft is just not kept */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}
