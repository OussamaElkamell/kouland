"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Icon } from "@kouland/ui";

/**
 * A date (or date and time) field that always reads day/month/year. The browser's own date box follows the
 * browser's language (month first in US English), so the visible box is text and the browser's calendar opens
 * from the button. The value stays in the input formats the forms already use: "2026-11-20" or "2026-11-20T14:30".
 */
export function DateInput({
  id,
  value,
  onChange,
  withTime = false,
  invalid,
  min,
  name,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  invalid?: boolean;
  min?: string;
  name?: string;
  required?: boolean;
}) {
  const hint = PLACEHOLDER[useLocale().slice(0, 2)] ?? PLACEHOLDER.en!;
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => display(value, withTime));
  const [focused, setFocused] = useState(false);

  // A value set from outside (the calendar, a default, a linked field) replaces the text unless it is being typed.
  useEffect(() => {
    if (!focused) setText(display(value, withTime));
  }, [value, withTime, focused]);

  function type(next: string) {
    setText(next);
    if (!next.trim()) return onChange("");
    const parsed = parse(next, withTime);
    if (parsed) onChange(parsed);
  }

  function openCalendar() {
    const input = picker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        required={required}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={withTime ? `${hint.date} ${hint.time}` : hint.date}
        value={text}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(display(value, withTime));
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`input pr-11 ${invalid ? "has-error" : ""}`}
      />
      <button
        type="button"
        onClick={openCalendar}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Icon name="calendar" className="h-4 w-4" />
      </button>
      {/* The browser's calendar, opened by the button; it sits under the field so the calendar appears there. */}
      <input
        ref={picker}
        type={withTime ? "datetime-local" : "date"}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}

/** What the empty field shows, in the page language. */
const PLACEHOLDER: Record<string, { date: string; time: string }> = {
  en: { date: "dd/mm/yyyy", time: "hh:mm" },
  fr: { date: "jj/mm/aaaa", time: "hh:mm" },
  es: { date: "dd/mm/aaaa", time: "hh:mm" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-20T14:30" → "20/11/2026 14:30". */
function display(value: string, withTime: boolean): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return "";
  const [, y, m, d, h, min] = match;
  return withTime && h ? `${d}/${m}/${y} ${h}:${min}` : `${d}/${m}/${y}`;
}

/** "20/11/2026 14:30" (or 20.11.2026, 20-11-2026) → "2026-11-20T14:30"; null while it is not a real date yet. */
function parse(text: string, withTime: boolean): string | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[\sT,]+(\d{1,2})[:h.](\d{2}))?\s*$/i.exec(text);
  if (!match) return null;
  const [, d, m, y, h, min] = match.map(Number) as number[];
  const date = new Date(y!, m! - 1, d!);
  if (date.getFullYear() !== y || date.getMonth() !== m! - 1 || date.getDate() !== d) return null;
  const day = `${y}-${pad(m!)}-${pad(d!)}`;
  if (!withTime) return match[4] ? null : day;
  if (match[4] === undefined) return null;
  if (h! > 23 || min! > 59) return null;
  return `${day}T${pad(h!)}:${pad(min!)}`;
}
