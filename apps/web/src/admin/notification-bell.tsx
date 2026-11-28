"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Notification, NotificationList } from "@kouland/contracts";
import { Icon } from "@kouland/ui";
import { api } from "@/lib/api";
import { useFormat } from "./hooks";

const POLL_MS = 60_000;

/** The bell: unread count, and the latest notifications in a panel. New ones are fetched every minute. */
export function NotificationBell({ placement = "down" }: { placement?: "down" | "right" }) {
  const t = useTranslations("notifications");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const router = useRouter();
  const [list, setList] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setList(await api.notifications.list());
    } catch {
      /* the bell stays as it was; the next poll tries again */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function describe(item: Notification): string {
    const d = item.data;
    const s = (key: string) => (d[key] === undefined || d[key] === null ? "" : String(d[key]));
    const values = {
      title: s("title"),
      number: s("number"),
      by: s("by"),
      platform: s("platform"),
      when: s("when") ? format.dateTime(s("when")) : "",
      // Missed calls and SMS: the customer's name, else the number.
      who: s("name") || s("from"),
      preview: s("preview"),
    };
    if (item.type === "TICKET_STATUS") return t("TICKET_STATUS", { ...values, status: tStatus(`ticket.${s("status") || "OPEN"}`) });
    if (item.type === "OPPORTUNITY_STATUS") return t("OPPORTUNITY_STATUS", { ...values, status: tStatus(`opportunity.${s("status") || "WON"}`) });
    return t(item.type, values);
  }

  async function openItem(item: Notification) {
    setOpen(false);
    if (!item.read) {
      await api.notifications.read(item.id).catch(() => undefined);
      void load();
    }
    router.push(item.link);
  }

  async function readAll() {
    await api.notifications.readAll().catch(() => undefined);
    void load();
  }

  const unread = list?.unread ?? 0;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm relative !px-2.5"
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
        aria-label={unread ? t("labelUnread", { count: unread }) : t("label")}
        aria-expanded={open}
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.62rem] font-bold text-on-brand">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          // Beside the sidebar it is fixed, so the sidebar's scroll area cannot cut it off.
          className={`z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-surface shadow-lift ${
            placement === "right" ? "fixed left-[17rem] top-4" : "absolute right-0 top-full mt-2"
          }`}
          role="dialog"
          aria-label={t("label")}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-display font-bold">{t("label")}</p>
            {unread > 0 && (
              <button type="button" className="text-xs font-semibold text-brand-text hover:underline" onClick={() => void readAll()}>
                {t("readAll")}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!list || list.items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-muted">{t("empty")}</li>
            ) : (
              list.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={`flex w-full gap-3 border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-surface-2 ${item.read ? "text-text-muted" : ""}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${item.read ? "bg-transparent" : "bg-brand"}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className={`block ${item.read ? "" : "font-semibold"}`}>{describe(item)}</span>
                      <span className="mt-0.5 block text-xs text-text-faint">{format.dateTime(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
