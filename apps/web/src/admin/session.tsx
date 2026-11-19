"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ApiError } from "@kouland/api-client";
import { levelAllows, type AccessLevel, type PermissionArea, type SessionUser } from "@kouland/contracts";
import { api } from "@/lib/api";
import { saveCrmLocale } from "./locale";

interface SessionContext {
  user: SessionUser;
  /** Reloads the account (after changing its own name, language or platforms). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Context = createContext<SessionContext | null>(null);

export function useSession(): SessionContext {
  const value = useContext(Context);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

/** What the signed-in account may do. Only a convenience for hiding buttons: the API checks every request. */
export function useCan() {
  const { user } = useSession();
  return {
    isAdmin: user.role === "ADMIN",
    can: (area: PermissionArea, level: AccessLevel) => levelAllows(user.access[area], level),
  };
}

/**
 * Loads the signed-in account once for every CRM screen. Without a valid session it sends the browser to the
 * login page and comes back here afterwards.
 */
export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [user, setUser] = useState<SessionUser | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
      // The account's language wins over this browser's cookie (e.g. first sign-in on another computer).
      if (me.locale !== locale) {
        saveCrmLocale(me.locale);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      throw error;
    }
  }, [router, pathname, locale]);

  useEffect(() => {
    if (!user) void load();
    // Only on first load; later reloads go through refresh().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    router.replace("/admin/login");
  }, [router]);

  if (!user) return <>{fallback}</>;
  return <Context.Provider value={{ user, refresh: load, signOut }}>{children}</Context.Provider>;
}
