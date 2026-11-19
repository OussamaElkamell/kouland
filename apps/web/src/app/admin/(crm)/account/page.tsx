"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Field, Input } from "@kouland/ui";
import { useSubmit } from "@/admin/hooks";
import { useSession } from "@/admin/session";
import { FormError, PageHeader, PlatformChip } from "@/admin/ui";
import { api } from "@/lib/api";

/** The signed-in person's own account: name and password. The language is changed from the sidebar. */
export default function AccountPage() {
  const t = useTranslations("account");
  const tn = useTranslations("nav");
  const tu = useTranslations("users");
  const tc = useTranslations("common");
  const { user, refresh } = useSession();
  const profile = useSubmit();
  const password = useSubmit();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saved, setSaved] = useState<"profile" | "password" | null>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaved(null);
    if (await profile.submit(() => api.auth.updateMe({ name }))) {
      await refresh();
      setSaved("profile");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setSaved(null);
    const done = await password.submit(async () => {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      return true;
    });
    if (done) {
      setCurrent("");
      setNext("");
      setSaved("password");
    }
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={`${user.email} · ${tn(`role.${user.role}`)}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card flex flex-col gap-4 p-5 sm:p-6" noValidate>
          <h2 className="font-display text-lg font-bold">{t("profile")}</h2>
          <FormError message={profile.formError} />
          <Field htmlFor="account-name" label={tu("name")} error={profile.errorFor("name")}>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!profile.errorFor("name")} />
          </Field>
          <div>
            <p className="field-label">{tu("platforms")}</p>
            {user.allPlatforms ? (
              <p className="text-sm text-text-muted">{tu("allPlatforms")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.platforms.map((platform) => (
                  <PlatformChip key={platform.id} platform={platform} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved === "profile" && <span className="text-sm text-success">{tc("saved")}</span>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={profile.pending}>
              {profile.pending ? tc("saving") : tc("save")}
            </button>
          </div>
        </form>

        <form onSubmit={savePassword} className="card flex flex-col gap-4 p-5 sm:p-6" noValidate>
          <h2 className="font-display text-lg font-bold">{t("password")}</h2>
          <FormError message={password.formError} />
          <Field htmlFor="current-password" label={t("currentPassword")} error={password.errorFor("currentPassword")}>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={!!password.errorFor("currentPassword")} />
          </Field>
          <Field htmlFor="new-password" label={t("newPassword")} hint={tu("passwordHint")} error={password.errorFor("newPassword")}>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!password.errorFor("newPassword")} />
          </Field>
          <p className="text-xs text-text-muted">{t("passwordNote")}</p>
          <div className="flex items-center justify-end gap-3">
            {saved === "password" && <span className="text-sm text-success">{t("passwordChanged")}</span>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={password.pending}>
              {password.pending ? tc("saving") : t("changePassword")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
