"use client";

/** Checkbox list of platforms, each with its configured colour. */
export function PlatformPicker({
  id,
  platforms,
  value,
  onChange,
  disabled,
}: {
  id: string;
  platforms: Array<{ id: string; name: string; color: string; isActive?: boolean }>;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (platformId: string) =>
    onChange(value.includes(platformId) ? value.filter((item) => item !== platformId) : [...value, platformId]);
  return (
    <div id={id} className="grid gap-2 sm:grid-cols-2">
      {platforms.map((platform) => {
        const checked = value.includes(platform.id);
        return (
          <label
            key={platform.id}
            className={`card-select flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold ${checked ? "selected" : ""} ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(platform.id)}
              className="h-4 w-4 accent-[rgb(var(--color-brand))]"
            />
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: platform.color }} aria-hidden="true" />
            <span className="truncate">{platform.name}</span>
          </label>
        );
      })}
    </div>
  );
}
