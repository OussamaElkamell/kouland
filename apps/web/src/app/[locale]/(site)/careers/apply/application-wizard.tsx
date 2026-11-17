"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@kouland/api-client";
import {
  APPLICATION_AREAS,
  APPLICATION_STEPS,
  CV_ACCEPT,
  CV_MAX_BYTES,
  CV_TYPES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  jobApplicationSchema,
  WORK_MODES,
  type ApplicationStep,
} from "@kouland/contracts";
import { ChoiceGroup, Field, Icon, Input, Textarea } from "@kouland/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import {
  clearDraft,
  EMPTY_APPLICATION,
  firstIncompleteStep,
  invalidFieldsOf,
  loadDraft,
  parseStep,
  saveDraft,
  stepOfField,
  STEP_FIELDS,
  type ApplicationField,
  type ApplicationValues,
  type FormStep,
} from "./application-draft";

type CvProblem = "cvMissing" | "cvTooLarge" | "cvWrongType";
type SubmitProblem = "tooMany" | "network" | "generic";

/**
 * The job application, one step per screen. The current step is in the URL (`?step=role`), so each step has its
 * own address and the browser's back and forward buttons move between steps. Answers are kept in session storage
 * (see application-draft.ts); a step can only be opened once the steps before it are complete.
 */
export function ApplicationWizard() {
  const t = useTranslations("careers.apply");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const step = parseStep(useSearchParams().get("step"));

  const [values, setValues] = useState<ApplicationValues>(EMPTY_APPLICATION);
  const [loaded, setLoaded] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [cvProblem, setCvProblem] = useState<CvProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitProblem, setSubmitProblem] = useState<SubmitProblem | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const goTo = (target: ApplicationStep | "done", mode: "push" | "replace" = "push") => {
    const href = { pathname, query: { step: target } };
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  // Restore the draft once, in the browser.
  useEffect(() => {
    setValues(loadDraft());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveDraft(values);
  }, [loaded, values]);

  // A step can only be shown when every step before it is complete; otherwise go to the first incomplete one.
  useEffect(() => {
    if (!loaded || step === "done") return;
    const blocking = firstIncompleteStep(values);
    const missingCv = !cv;
    const order = APPLICATION_STEPS.indexOf(step);
    if (blocking && APPLICATION_STEPS.indexOf(blocking) < order) goTo(blocking, "replace");
    else if (missingCv && order > APPLICATION_STEPS.indexOf("experience")) goTo("experience", "replace");
    // goTo only reads the current pathname, so it does not need to re-run this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, step]);

  // New step: start at the top and move focus to its heading for keyboard and screen-reader users.
  useEffect(() => {
    if (!loaded) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
    setSubmitProblem(null);
  }, [loaded, step]);

  const set = <K extends ApplicationField>(field: K, value: ApplicationValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (invalid.has(field)) setInvalid((current) => new Set([...current].filter((name) => name !== field)));
  };

  function chooseCv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(file.type in CV_TYPES) && !/\.(pdf|docx?)$/i.test(file.name)) return setCvProblem("cvWrongType");
    if (file.size > CV_MAX_BYTES) return setCvProblem("cvTooLarge");
    setCv(file);
    setCvProblem(null);
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "done" || step === "review") return;
    const fields = invalidFieldsOf(step, values);
    const cvMissing = step === "experience" && !cv;
    setInvalid(new Set(fields));
    if (cvMissing) setCvProblem("cvMissing");
    if (fields.length > 0 || cvMissing) {
      const first = fields[0] ?? "cv";
      document.getElementById(`apply-${first}`)?.focus();
      return;
    }
    goTo(APPLICATION_STEPS[APPLICATION_STEPS.indexOf(step) + 1] ?? "review");
  }

  async function submit() {
    if (!cv) return goTo("experience");
    // Same rules as the API: if anything changed or is missing, go back to the first step that needs it.
    const parsed = jobApplicationSchema.safeParse(values);
    if (!parsed.success) return goTo(firstIncompleteStep(values) ?? "profile");
    setSubmitting(true);
    setSubmitProblem(null);
    try {
      await api.careers.apply(parsed.data, cv, cv.name, locale);
      clearDraft();
      setValues(EMPTY_APPLICATION);
      setCv(null);
      goTo("done", "replace");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        // Send the applicant back to the step of the first refused field.
        const fields = Object.keys(error.fieldErrors);
        const cvError = error.fieldErrors.cv?.[0];
        if (cvError) setCvProblem(cvError === "tooLarge" ? "cvTooLarge" : cvError === "wrongType" ? "cvWrongType" : "cvMissing");
        setInvalid(new Set(fields.filter((field) => field !== "cv")));
        const target = fields.map(stepOfField).find((found): found is FormStep => found !== null);
        if (target) goTo(target);
      } else if (error instanceof ApiError) {
        setSubmitProblem(error.status === 429 ? "tooMany" : error.status === 413 ? "generic" : error.status === 0 ? "network" : "generic");
        if (error.status === 413) {
          setCvProblem("cvTooLarge");
          goTo("experience");
        }
      } else {
        setSubmitProblem("generic");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") return <Done />;
  if (!loaded) return <div className="card h-96 animate-pulse" aria-busy="true" />;

  const index = APPLICATION_STEPS.indexOf(step);
  const errorOf = (field: ApplicationField) => (invalid.has(field) ? t(`errors.${field}`) : undefined);
  const control = (field: Exclude<ApplicationField, "consent">) => ({
    id: `apply-${field}`,
    name: field,
    value: values[field],
    invalid: invalid.has(field),
    onChange: (event: { target: { value: string } }) => set(field, event.target.value),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:items-start">
      <StepList current={step} />

      <div className="card p-6 sm:p-8">
        <p className="eyebrow mb-2">{t("stepOf", { current: index + 1, total: APPLICATION_STEPS.length })}</p>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-extrabold tracking-tight outline-none">
          {t(`steps.${step}`)}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{t(`stepIntro.${step}`)}</p>

        {step === "review" ? (
          <Review values={values} cv={cv} onEdit={(target) => goTo(target)} submitting={submitting} problem={submitProblem} onSubmit={submit} />
        ) : (
          <form onSubmit={next} noValidate className="mt-6 flex flex-col gap-5">
            {step === "profile" && (
              <>
                <Field htmlFor="apply-fullName" label={t("fields.fullName")} error={errorOf("fullName")}>
                  <Input {...control("fullName")} autoComplete="name" required />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="apply-email" label={t("fields.email")} error={errorOf("email")}>
                    <Input {...control("email")} type="email" autoComplete="email" required />
                  </Field>
                  <Field htmlFor="apply-phone" label={t("fields.phone")} error={errorOf("phone")}>
                    <Input {...control("phone")} type="tel" autoComplete="tel" required />
                  </Field>
                  <Field htmlFor="apply-city" label={t("fields.city")} error={errorOf("city")}>
                    <Input {...control("city")} autoComplete="address-level2" required />
                  </Field>
                  <Field htmlFor="apply-country" label={t("fields.country")} error={errorOf("country")}>
                    <Input {...control("country")} autoComplete="country-name" required />
                  </Field>
                </div>
              </>
            )}

            {step === "role" && (
              <>
                <ChoiceGroup
                  name="apply-area"
                  legend={t("fields.area")}
                  columns={3}
                  value={values.area as (typeof APPLICATION_AREAS)[number] | ""}
                  onChange={(value) => set("area", value)}
                  error={errorOf("area")}
                  choices={APPLICATION_AREAS.map((value) => ({ value, label: t(`options.area.${value}`), description: t(`options.areaHint.${value}`) }))}
                />
                <Field htmlFor="apply-position" label={t("fields.position")} hint={t("fields.positionHint")} error={errorOf("position")}>
                  <Input {...control("position")} required />
                </Field>
                <ChoiceGroup
                  name="apply-employmentType"
                  legend={t("fields.employmentType")}
                  value={values.employmentType as (typeof EMPLOYMENT_TYPES)[number] | ""}
                  onChange={(value) => set("employmentType", value)}
                  error={errorOf("employmentType")}
                  choices={EMPLOYMENT_TYPES.map((value) => ({ value, label: t(`options.employmentType.${value}`) }))}
                />
                <ChoiceGroup
                  name="apply-workMode"
                  legend={t("fields.workMode")}
                  columns={3}
                  value={values.workMode as (typeof WORK_MODES)[number] | ""}
                  onChange={(value) => set("workMode", value)}
                  error={errorOf("workMode")}
                  choices={WORK_MODES.map((value) => ({ value, label: t(`options.workMode.${value}`) }))}
                />
              </>
            )}

            {step === "experience" && (
              <>
                <ChoiceGroup
                  name="apply-experienceLevel"
                  legend={t("fields.experienceLevel")}
                  value={values.experienceLevel as (typeof EXPERIENCE_LEVELS)[number] | ""}
                  onChange={(value) => set("experienceLevel", value)}
                  error={errorOf("experienceLevel")}
                  choices={EXPERIENCE_LEVELS.map((value) => ({ value, label: t(`options.experienceLevel.${value}`) }))}
                />
                <Field htmlFor="apply-skills" label={t("fields.skills")} hint={t("fields.skillsHint")} error={errorOf("skills")}>
                  <Input {...control("skills")} required />
                </Field>
                <Field htmlFor="apply-motivation" label={t("fields.motivation")} hint={t("fields.motivationHint")} error={errorOf("motivation")}>
                  <Textarea {...control("motivation")} rows={6} required />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="apply-linkedinUrl" label={t("fields.linkedinUrl")} optionalLabel={t("optional")} error={errorOf("linkedinUrl")}>
                    <Input {...control("linkedinUrl")} type="url" inputMode="url" placeholder="https://" />
                  </Field>
                  <Field htmlFor="apply-portfolioUrl" label={t("fields.portfolioUrl")} optionalLabel={t("optional")} error={errorOf("portfolioUrl")}>
                    <Input {...control("portfolioUrl")} type="url" inputMode="url" placeholder="https://" />
                  </Field>
                </div>
                <CvField file={cv} problem={cvProblem} onChoose={chooseCv} />
              </>
            )}

            {step === "availability" && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="apply-availableFrom" label={t("fields.availableFrom")} error={errorOf("availableFrom")}>
                    <Input {...control("availableFrom")} type="date" min={new Date().toISOString().slice(0, 10)} required />
                  </Field>
                  <Field htmlFor="apply-salaryExpectation" label={t("fields.salaryExpectation")} optionalLabel={t("optional")} error={errorOf("salaryExpectation")}>
                    <Input {...control("salaryExpectation")} />
                  </Field>
                </div>
                <div>
                  <label htmlFor="apply-consent" className="checkbox-row text-sm">
                    <input
                      id="apply-consent"
                      type="checkbox"
                      checked={values.consent}
                      onChange={(event) => set("consent", event.target.checked)}
                      aria-invalid={invalid.has("consent") || undefined}
                      aria-describedby={invalid.has("consent") ? "apply-consent-error" : undefined}
                    />
                    <span>{t("fields.consent")}</span>
                  </label>
                  {invalid.has("consent") && (
                    <p id="apply-consent-error" className="field-error" role="alert">
                      {t("errors.consent")}
                    </p>
                  )}
                </div>
              </>
            )}

            <StepButtons back={index > 0 ? () => goTo(APPLICATION_STEPS[index - 1] ?? "profile") : undefined} nextLabel={t("next")} backLabel={t("back")} />
          </form>
        )}
      </div>
    </div>
  );
}

/** CV picker: PDF or Word up to 5 MB, shown as a drop-zone-style box with the chosen file's name and size. */
function CvField({ file, problem, onChoose }: { file: File | null; problem: CvProblem | null; onChoose: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const t = useTranslations("careers.apply");
  const locale = useLocale();
  return (
    <div>
      <p className="field-label" id="apply-cv-label">
        {t("fields.cv")}
      </p>
      <div className={`flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed p-4 ${problem ? "border-error" : "border-border-strong"}`}>
        <Icon name="upload" className="h-5 w-5 text-brand" />
        <span className="min-w-0 flex-1 text-sm">
          {file ? (
            <span className="font-semibold break-all">
              {file.name} <span className="font-normal text-text-muted">({formatSize(file.size, locale)})</span>
            </span>
          ) : (
            <span className="text-text-muted">{t("fields.cvHint")}</span>
          )}
        </span>
        <label htmlFor="apply-cv" className="btn btn-outline btn-sm cursor-pointer">
          {file ? t("fields.cvReplace") : t("fields.cvChoose")}
        </label>
        <input
          id="apply-cv"
          type="file"
          accept={CV_ACCEPT}
          onChange={onChoose}
          className="sr-only"
          aria-labelledby="apply-cv-label"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "apply-cv-error" : undefined}
        />
      </div>
      {problem && (
        <p id="apply-cv-error" className="field-error" role="alert">
          {t(`errors.${problem}`)}
        </p>
      )}
    </div>
  );
}

function formatSize(bytes: number, locale: string): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return bytes >= 1024 * 1024 ? `${format.format(bytes / 1024 / 1024)} MB` : `${format.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/** The list of steps beside the form (a row of dots on small screens). Completed steps are links. */
function StepList({ current }: { current: ApplicationStep }) {
  const t = useTranslations("careers.apply");
  const pathname = usePathname();
  const currentIndex = APPLICATION_STEPS.indexOf(current);

  return (
    <nav aria-label={t("progress")}>
      <ol className="flex gap-2 lg:flex-col lg:gap-1">
        {APPLICATION_STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          const content = (
            <>
              <span className={`step-dot ${state === "todo" ? "" : state}`}>
                {state === "done" ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={`hidden text-sm font-semibold lg:inline ${state === "current" ? "text-text" : "text-text-muted"}`}>{t(`steps.${step}`)}</span>
            </>
          );
          return (
            <li key={step} className="flex-1 lg:flex-none">
              {state === "done" ? (
                <Link href={{ pathname, query: { step } }} scroll={false} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-surface-2">
                  {content}
                  <span className="sr-only">{t("edit")}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-3 p-1.5" aria-current={state === "current" ? "step" : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepButtons({ back, backLabel, nextLabel }: { back?: () => void; backLabel: string; nextLabel: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      {back ? (
        <button type="button" onClick={back} className="btn btn-ghost">
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button type="submit" className="btn btn-primary">
        {nextLabel}
        <Icon name="arrow" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Last step: everything the applicant entered, each block with a link back to its step, then the submit button. */
function Review({
  values,
  cv,
  onEdit,
  submitting,
  problem,
  onSubmit,
}: {
  values: ApplicationValues;
  cv: File | null;
  onEdit: (step: FormStep) => void;
  submitting: boolean;
  problem: SubmitProblem | null;
  onSubmit: () => void;
}) {
  const t = useTranslations("careers.apply");
  const label = (field: ApplicationField, value: string): ReactNode => {
    if (!value) return <span className="text-text-faint">{t("review.notProvided")}</span>;
    if (field === "area" || field === "employmentType" || field === "workMode" || field === "experienceLevel") return t(`options.${field}.${value}`);
    return value;
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {(Object.keys(STEP_FIELDS) as FormStep[]).map((step) => (
        <section key={step} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-display font-bold">{t(`steps.${step}`)}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(step)}>
              {t("edit")}
            </button>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
            {STEP_FIELDS[step]
              .filter((field) => field !== "consent")
              .map((field) => (
                <div key={field} className="contents">
                  <dt className="text-text-muted">{t(`fields.${field}`)}</dt>
                  <dd className="min-w-0 break-words whitespace-pre-wrap">{label(field, String(values[field]))}</dd>
                </div>
              ))}
            {step === "experience" && (
              <div className="contents">
                <dt className="text-text-muted">{t("fields.cv")}</dt>
                <dd className="min-w-0 break-all">{cv?.name ?? t("review.notProvided")}</dd>
              </div>
            )}
          </dl>
        </section>
      ))}

      {problem && (
        <p className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {t(`errors.${problem}`)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <button type="button" className="btn btn-ghost" onClick={() => onEdit("availability")}>
          {t("back")}
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onSubmit} disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </button>
      </div>
    </div>
  );
}

function Done() {
  const t = useTranslations("careers.apply.done");
  return (
    <div className="card mx-auto flex max-w-2xl flex-col items-start gap-4 p-8" role="status">
      <span className="badge badge-success">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
        {t("badge")}
      </span>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</h2>
      <p className="text-text-muted">{t("body")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          {t("home")}
        </Link>
        <Link href="/careers" className="btn btn-outline">
          {t("careers")}
        </Link>
      </div>
    </div>
  );
}
