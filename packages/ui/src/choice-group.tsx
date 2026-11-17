import type { ReactNode } from "react";

export interface Choice<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
}

interface ChoiceGroupProps<V extends string> {
  /** Used for the radio inputs' `name` and as the id prefix; the error is linked as `${name}-error`. */
  name: string;
  legend: string;
  choices: ReadonlyArray<Choice<V>>;
  value: V | "";
  onChange: (value: V) => void;
  error?: string;
  /** Grid columns on wide screens. */
  columns?: 2 | 3;
}

/** A set of radio buttons shown as selectable cards (`.card-select`), keyboard-accessible like any radio group. */
export function ChoiceGroup<V extends string>({ name, legend, choices, value, onChange, error, columns = 2 }: ChoiceGroupProps<V>) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className={`grid gap-3 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
        {choices.map((choice) => {
          const id = `${name}-${choice.value}`;
          const checked = value === choice.value;
          return (
            <label key={choice.value} htmlFor={id} className={`card-select flex items-start gap-3 p-4 ${checked ? "selected" : ""}`}>
              <input
                id={id}
                type="radio"
                name={name}
                value={choice.value}
                checked={checked}
                onChange={() => onChange(choice.value)}
                className="mt-1 h-4 w-4 flex-none accent-[rgb(var(--color-brand))]"
              />
              <span>
                <span className="block text-sm font-semibold">{choice.label}</span>
                {choice.description && <span className="mt-0.5 block text-xs text-text-muted">{choice.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
