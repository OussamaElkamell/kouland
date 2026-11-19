"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, Input } from "@kouland/ui";
import { useSubmit } from "@/admin/hooks";
import { saveCrmLocale } from "@/admin/locale";
import { FormError } from "@/admin/ui";
import { api } from "@/lib/api";

/** Only paths inside the CRM, so the "next" parameter cannot send people to another site after signing in. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/admin") && !value.startsWith("//") && !value.startsWith("/admin/login") ? value : "/admin";
}

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const { submit, pending, formError, errorFor } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const user = await submit(() => api.auth.login({ email, password }));
    if (!user) return;
    saveCrmLocale(user.locale);
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <Field htmlFor="email" label={t("email")} error={errorFor("email")}>
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errorFor("email")} />
      </Field>
      <Field htmlFor="password" label={t("password")} error={errorFor("password")}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={!!errorFor("password")}
        />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations("login");
  return (
    <main className="glow-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/kouland-technology-logo.png" alt="Kouland Technology, Inc." width={828} height={261} className="h-12 w-auto" priority />
          <h1 className="mt-6 font-display text-2xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>
        </div>
        <div className="card p-6 sm:p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-text-faint">{t("help")}</p>
      </div>
    </main>
  );
}
