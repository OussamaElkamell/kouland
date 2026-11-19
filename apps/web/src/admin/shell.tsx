"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Icon, type IconName } from "@kouland/ui";
import { CRM_LOCALES, type CrmLocale } from "@kouland/contracts";
import { api } from "@/lib/api";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { LOCALE_NAMES, saveCrmLocale } from "./locale";
import { useCan, useSession } from "./session";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

/** Sidebar + top bar around every signed-in CRM screen. On phones the sidebar opens as a drawer. */
export function CrmShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useSession();
  const { can, isAdmin } = useCan();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const main: NavItem[] = [
    { href: "/admin", label: t("overview"), icon: "home", exact: true },
    ...(can("CUSTOMERS", "VIEW") ? [{ href: "/admin/customers", label: t("customers"), icon: "users" as const }] : []),
    ...(can("SALES", "VIEW") ? [{ href: "/admin/sales", label: t("sales"), icon: "chart" as const }] : []),
  ];
  const settings: NavItem[] = isAdmin
    ? [
        { href: "/admin/settings/platforms", label: t("platformSettings"), icon: "globe" },
        { href: "/admin/settings/users", label: t("users"), icon: "lock" },
      ]
    : [];
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const sidebar = (
    <nav aria-label={t("label")} className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
      <Link href="/admin" className="flex items-center gap-2 px-2">
        <Image src="/brand/kouland-technology-logo.png" alt="Kouland Technology, Inc." width={828} height={261} className="h-8 w-auto" priority />
        <span className="rounded-md border px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">CRM</span>
      </Link>

      <ul className="flex flex-col gap-1">
        {main.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={`sidebar-link ${isActive(item) ? "active" : ""}`} aria-current={isActive(item) ? "page" : undefined}>
              <Icon name={item.icon} className="h-[1.125rem] w-[1.125rem]" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {user.platforms.length > 0 && (
        <div>
          <p className="eyebrow mb-2 px-2">{t("platforms")}</p>
          <ul className="flex flex-col gap-1">
            {user.platforms.map((platform) => {
              const href = `/admin/p/${platform.slug}`;
              const active = pathname.startsWith(href);
              return (
                <li key={platform.id}>
                  <Link href={href} className={`sidebar-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="flex h-[1.125rem] w-[1.125rem] items-center justify-center" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: platform.color }} />
                    </span>
                    <span className="truncate">{platform.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {settings.length > 0 && (
        <div>
          <p className="eyebrow mb-2 px-2">{t("settings")}</p>
          <ul className="flex flex-col gap-1">
            {settings.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`sidebar-link ${isActive(item) ? "active" : ""}`} aria-current={isActive(item) ? "page" : undefined}>
                  <Icon name={item.icon} className="h-[1.125rem] w-[1.125rem]" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AccountBox />
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r bg-bg-alt lg:block">{sidebar}</aside>

      {/* Phone and tablet: top bar with a menu button, sidebar as a drawer. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-bg-alt/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/kouland-technology-logo.png" alt="Kouland Technology, Inc." width={828} height={261} className="h-7 w-auto" />
        </Link>
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setOpen(true)} aria-label={t("open")} aria-expanded={open}>
          <Icon name="menu" className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("label")}>
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label={t("close")} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-bg-alt shadow-lift">{sidebar}</div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Signed-in account at the bottom of the sidebar: language, theme, own account, sign out. */
function AccountBox() {
  const t = useTranslations("nav");
  const router = useRouter();
  const locale = useLocale();
  const { user, signOut, refresh } = useSession();

  async function changeLocale(next: CrmLocale) {
    saveCrmLocale(next);
    await api.auth.updateMe({ locale: next }).catch(() => undefined);
    await refresh();
    router.refresh();
  }

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="mt-auto flex flex-col gap-3 border-t pt-4">
      <Link href="/admin/account" className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-text-muted">{t(`role.${user.role}`)}</span>
        </span>
      </Link>
      <div className="flex items-center gap-2 px-1">
        <label htmlFor="crm-language" className="sr-only">
          {t("language")}
        </label>
        <select id="crm-language" className="select !py-1.5 text-xs" value={locale} onChange={(event) => void changeLocale(event.target.value as CrmLocale)}>
          {CRM_LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
        <button type="button" onClick={toggleTheme} className="btn btn-ghost btn-sm !px-2.5" aria-label={t("theme")} title={t("theme")}>
          <Icon name="sun" className="hidden h-[1.125rem] w-[1.125rem] dark:block" />
          <Icon name="moon" className="h-[1.125rem] w-[1.125rem] dark:hidden" />
        </button>
      </div>
      <button type="button" className="btn btn-outline btn-sm w-full" onClick={() => void signOut()}>
        {t("signOut")}
      </button>
    </div>
  );
}
