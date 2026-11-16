import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface FieldProps {
  /** Must match the `id` of the control inside. */
  htmlFor: string;
  label: string;
  /** Shown after the label for fields that can be left empty, in the page language, e.g. "(optional)". */
  optionalLabel?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Label + control + hint or error. The error is linked to the control by `${htmlFor}-error`. */
export function Field({ htmlFor, label, optionalLabel, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {optionalLabel && <span className="font-normal text-text-muted"> {optionalLabel}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

interface ControlState {
  id: string;
  /** Marks the control invalid and links it to the Field's error text. */
  invalid?: boolean;
}

function controlProps({ id, invalid }: ControlState) {
  return { id, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `${id}-error` : undefined };
}

export function Input({ id, invalid, className = "", ...rest }: ControlState & InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} {...controlProps({ id, invalid })} className={`input ${invalid ? "has-error" : ""} ${className}`} />;
}

export function Textarea({ id, invalid, className = "", ...rest }: ControlState & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} {...controlProps({ id, invalid })} className={`textarea ${invalid ? "has-error" : ""} ${className}`} />;
}
