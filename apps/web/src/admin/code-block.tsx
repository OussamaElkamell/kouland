"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";

/** Copies text to the clipboard and says so for two seconds. */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations("integration");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Icon name={copied ? "check" : "document"} className="h-4 w-4" />
      {copied ? t("copied") : (label ?? t("copy"))}
    </button>
  );
}

/** Code shown as is (never translated), with a copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-surface-2">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-semibold text-text-muted">{label}</span>
        <CopyButton text={code} />
      </div>
      <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Tabs over several code blocks (languages). */
export function CodeTabs({ tabs }: { tabs: Array<{ id: string; label: string; code: string }> }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current?.id}
            onClick={() => setActive(tab.id)}
            className={`btn btn-sm ${tab.id === current?.id ? "btn-primary" : "btn-ghost"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current && <CodeBlock code={current.code} label={current.label} />}
    </div>
  );
}
