/**
 * <input type="datetime-local"> works in the browser's local time without a zone ("2026-11-20T14:30"). These turn
 * it into an ISO instant for the API and back.
 */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** Local input value for "now + minutes", rounded to the next quarter hour. */
export function localInputIn(minutes: number): string {
  const date = new Date(Date.now() + minutes * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(date.toISOString());
}
