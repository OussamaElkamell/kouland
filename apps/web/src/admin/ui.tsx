"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@kouland/ui";
import type { PlatformRef } from "@kouland/contracts";

/** Title row of a CRM screen, with an optional back link and actions on the right. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-text">
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * A platform's name with its configured colour. The colour comes from the platform record, so a platform added
 * in the settings shows up the same way without any code change.
 */
export function PlatformChip({ platform, size = "md" }: { platform: Pick<PlatformRef, "name" | "color">; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-surface-2 font-semibold text-text ${size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs"}`}
    >
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: platform.color }} aria-hidden="true" />
      {platform.name}
    </span>
  );
}

export type Tone = "brand" | "success" | "warning" | "error" | "info" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-surface-2 text-text-muted">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-[rgb(var(--color-error-bg))] p-4 text-sm text-error">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          {t("retry")}
        </button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-5" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-10" />
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const t = useTranslations("common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm text-text-muted">
      <span>{t("range", { from, to, total })}</span>
      {pages > 1 && (
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {t("previous")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            {t("next")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Native <dialog>: Esc closes it and focus stays inside, from the browser. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("common");
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      style={wide ? { width: "min(52rem, calc(100vw - 2rem))", maxHeight: "calc(100vh - 2rem)" } : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="modal-panel">
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label={t("close")}>
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Asks before an action that cannot be undone. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="btn btn-danger-outline" disabled={pending} onClick={onConfirm}>
            {pending ? t("working") : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-text-muted">{body}</p>
      {error && <p className="field-error mt-3">{error}</p>}
    </Modal>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-error/30 bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-error">
      {message}
    </p>
  );
}

/** Label/value pairs on detail screens. Empty values are left out. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {shown.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-faint">{item.label}</dt>
          <dd className="mt-1 break-words text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Select({
  id,
  value,
  onChange,
  children,
  invalid,
  className = "",
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`select ${invalid ? "has-error" : ""} ${className}`}
    >
      {children}
    </select>
  );
}
