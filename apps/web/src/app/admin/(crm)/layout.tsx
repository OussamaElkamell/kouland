"use client";

import { SessionProvider } from "@/admin/session";
import { CrmShell } from "@/admin/shell";

/** Every CRM screen except the login page: needs a session, shows the sidebar. */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      fallback={
        <div className="flex min-h-screen items-center justify-center" aria-busy="true">
          <div className="skeleton h-10 w-48" />
        </div>
      }
    >
      <CrmShell>{children}</CrmShell>
    </SessionProvider>
  );
}
