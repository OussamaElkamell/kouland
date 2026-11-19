"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, Input } from "@kouland/ui";
import { useLoad, useSubmit } from "@/admin/hooks";
import { saveCrmLocale } from "@/admin/locale";
import { ErrorNotice, FormError, LoadingRows } from "@/admin/ui";
import { api } from "@/lib/api";

/**
 * Opened from the invitation or password email: the person chooses their password, then lands in the CRM signed in.
 */
function ChoosePassword() {
  const t = useTranslations("link");
  const router = useRouter();
  const locale = useLocale();
  const token = useSearchParams().get("token") ?? "";
  const info = useLoad(() => api.auth.linkInfo(token), [token]);
  const { submit, pending, formError, errorFor, setFormError } = useSubmit();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  // Show the page in the person's own CRM language.
  useEffect(() => {
    if (info.data && info.data.locale !== locale) {
      saveCrmLocale(info.data.locale);
      router.refresh();
    }
  }, [info.data, locale, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== repeat) {
      setFormError(t("mismatch"));
      return;
    }
    const user = await submit(() => api.auth.useLink(token, password));
    if (!user) return;
    saveCrmLocale(user.locale);
    router.replace("/admin");
    router.refresh();
  }

  if (info.error) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorNotice message={info.error.status === 410 || info.error.status === 404 ? t("expired") : info.error.message} />
        <Link href="/admin/login" className="btn btn-outline w-full">
          {t("toLogin")}
        </Link>
      </div>
    );
  }
  if (!info.data) return <LoadingRows rows={3} />;

  const invite = info.data.purpose === "INVITE";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="font-display text-xl font-extrabold">{invite ? t("welcome", { name: info.data.name }) : t("resetTitle")}</h1>
        <p className="mt-1 text-sm text-text-muted">{invite ? t("inviteBody") : t("resetBody")}</p>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-text-muted">{t("account")}</span> <strong>{info.data.email}</strong>
        </p>
      </div>
      <FormError message={formError} />
      {/* Lets password managers save the new password under the right account. */}
      <input type="email" name="username" autoComplete="username" value={info.data.email} readOnly hidden />
      <Field htmlFor="new-password" label={t("password")} hint={t("passwordHint")} error={errorFor("password")}>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errorFor("password")} />
      </Field>
      <Field htmlFor="repeat-password" label={t("repeat")}>
        <Input id="repeat-password" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending || !password}>
        {pending ? t("saving") : invite ? t("start") : t("save")}
      </button>
    </form>
  );
}

export default function LinkPage() {
  return (
    <main className="glow-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image src="/brand/kouland-technology-logo.png" alt="Kouland Technology, Inc." width={828} height={261} className="h-12 w-auto" priority />
        </div>
        <div className="card p-6 sm:p-8">
          <Suspense fallback={<LoadingRows rows={3} />}>
            <ChoosePassword />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
