"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  ACCESS_LEVELS,
  CRM_LOCALES,
  levelAllows,
  MAX_LEVEL_BY_ROLE,
  PERMISSION_AREAS,
  USER_ROLES,
  type AccessLevel,
  type AccessMap,
  type CrmLocale,
  type User,
  type UserRole,
} from "@kouland/contracts";
import { Field, Icon, Input } from "@kouland/ui";
import { useFormat, useLoad, useSubmit } from "@/admin/hooks";
import { LOCALE_NAMES } from "@/admin/locale";
import { PlatformPicker } from "@/admin/platform-picker";
import { useCan, useSession } from "@/admin/session";
import { Badge, ErrorNotice, FormError, LoadingRows, Modal, PageHeader, PlatformChip, Select } from "@/admin/ui";
import { api } from "@/lib/api";

interface Values {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  locale: CrmLocale;
  access: AccessMap;
  allPlatforms: boolean;
  platformIds: string[];
  isActive: boolean;
}

const EMPTY: Values = {
  name: "",
  email: "",
  password: "",
  role: "MANAGER",
  locale: "en",
  access: { CUSTOMERS: "EDIT", SALES: "EDIT" },
  allPlatforms: false,
  platformIds: [],
  isActive: true,
};

/** Administrators create manager and employee accounts and choose what each can do and which platforms they see. */
export default function UsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const format = useFormat();
  const { isAdmin } = useCan();
  const { user: me } = useSession();
  const users = useLoad(() => api.users.list(), []);
  const platforms = useLoad(() => api.platforms.list(true), []);
  const form = useSubmit();
  const reset = useSubmit();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [values, setValues] = useState<Values>(EMPTY);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  if (!isAdmin) return <ErrorNotice message={t("adminOnly")} />;
  const platformById = new Map((platforms.data ?? []).map((platform) => [platform.id, platform]));

  function open(user: User | "new") {
    setValues(
      user === "new"
        ? EMPTY
        : {
            name: user.name,
            email: user.email,
            password: "",
            role: user.role,
            locale: user.locale,
            access: user.access,
            allPlatforms: user.allPlatforms,
            platformIds: user.platformIds,
            isActive: user.isActive,
          },
    );
    setEditing(user);
  }

  /** Changing the role lowers any level the new role cannot have. */
  function setRole(role: UserRole) {
    const max = MAX_LEVEL_BY_ROLE[role];
    const access = { ...values.access };
    for (const area of PERMISSION_AREAS) if (access[area] && !levelAllows(max, access[area]!)) access[area] = max;
    setValues({ ...values, role, access });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const shared = { name: values.name, role: values.role, locale: values.locale, access: values.access, allPlatforms: values.allPlatforms, platformIds: values.platformIds };
    const saved = await form.submit(() =>
      editing === "new"
        ? api.users.create({ ...shared, email: values.email, password: values.password })
        : api.users.update((editing as User).id, { ...shared, isActive: values.isActive }),
    );
    if (saved) {
      setEditing(null);
      await users.reload();
    }
  }

  async function onReset(event: FormEvent) {
    event.preventDefault();
    if (!resetting) return;
    const done = await reset.submit(async () => {
      await api.users.resetPassword(resetting.id, newPassword);
      return true;
    });
    if (done) {
      setResetting(null);
      setNewPassword("");
    }
  }

  const isAdminRole = values.role === "ADMIN";

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open("new")}>
            <Icon name="plus" className="h-4 w-4" />
            {t("add")}
          </button>
        }
      />

      <div className="card overflow-hidden">
        {users.error ? (
          <div className="p-4">
            <ErrorNotice message={users.error.message} onRetry={users.reload} />
          </div>
        ) : !users.data ? (
          <LoadingRows rows={4} />
        ) : (
          <ul className="divide-y">
            {users.data.map((user) => (
              <li key={user.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${user.isActive ? "" : "opacity-60"}`}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-2 font-bold">{user.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {user.name}
                    <Badge tone={user.role === "ADMIN" ? "brand" : "neutral"}>{tn(`role.${user.role}`)}</Badge>
                    {!user.isActive && <Badge tone="error">{t("inactive")}</Badge>}
                    {user.id === me.id && <span className="text-xs font-normal text-text-muted">{t("you")}</span>}
                  </p>
                  <p className="truncate text-sm text-text-muted">{user.email}</p>
                  {user.role !== "ADMIN" && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                      {PERMISSION_AREAS.map((area) => (
                        <span key={area}>
                          {t(`area.${area}`)}: <strong className="text-text">{user.access[area] ? t(`level.${user.access[area]}`) : t("level.NONE")}</strong>
                        </span>
                      ))}
                      <span aria-hidden="true">·</span>
                      {user.allPlatforms
                        ? t("allPlatforms")
                        : user.platformIds.map((id) => platformById.get(id)).filter(Boolean).map((platform) => <PlatformChip key={platform!.id} platform={platform!} size="sm" />)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-faint">{t("lastLogin", { date: user.lastLoginAt ? format.dateTime(user.lastLoginAt) : t("never") })}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => open(user)}>
                    <Icon name="pencil" className="h-4 w-4" />
                    {tc("edit")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetting(user)}>
                    {t("resetPassword")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("add") : t("edit")}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <FormError message={form.formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="user-name" label={t("name")} error={form.errorFor("name")}>
              <Input id="user-name" value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!form.errorFor("name")} />
            </Field>
            <Field htmlFor="user-email" label={t("email")} error={form.errorFor("email")} hint={editing !== "new" ? t("emailFixed") : undefined}>
              <Input id="user-email" type="email" value={values.email} disabled={editing !== "new"} onChange={(e) => set("email", e.target.value)} invalid={!!form.errorFor("email")} />
            </Field>
            {editing === "new" && (
              <Field htmlFor="user-password" label={t("password")} hint={t("passwordHint")} error={form.errorFor("password")}>
                <Input id="user-password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!form.errorFor("password")} />
              </Field>
            )}
            <Field htmlFor="user-role" label={t("role")} hint={t(`roleHint.${values.role}`)} error={form.errorFor("role")}>
              <Select id="user-role" value={values.role} onChange={(value) => setRole(value as UserRole)}>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {tn(`role.${role}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="user-locale" label={t("language")}>
              <Select id="user-locale" value={values.locale} onChange={(value) => set("locale", value as CrmLocale)}>
                {CRM_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_NAMES[code]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!isAdminRole && (
            <>
              <fieldset>
                <legend className="field-label">{t("access")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PERMISSION_AREAS.map((area) => (
                    <Field key={area} htmlFor={`access-${area}`} label={t(`area.${area}`)} error={form.errorFor(`access.${area}`)}>
                      <Select
                        id={`access-${area}`}
                        value={values.access[area] ?? ""}
                        onChange={(value) => set("access", { ...values.access, [area]: (value || null) as AccessLevel | null })}
                      >
                        <option value="">{t("level.NONE")}</option>
                        {ACCESS_LEVELS.filter((level) => levelAllows(MAX_LEVEL_BY_ROLE[values.role], level)).map((level) => (
                          <option key={level} value={level}>
                            {t(`level.${level}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
                <p className="field-hint">{t("levelHint")}</p>
              </fieldset>

              <fieldset>
                <legend className="field-label">{t("platforms")}</legend>
                <label className="checkbox-row mb-3 text-sm">
                  <input type="checkbox" checked={values.allPlatforms} onChange={(e) => set("allPlatforms", e.target.checked)} />
                  {t("allPlatformsLabel")}
                </label>
                <PlatformPicker id="user-platforms" platforms={platforms.data ?? []} value={values.platformIds} onChange={(ids) => set("platformIds", ids)} disabled={values.allPlatforms} />
                {form.errorFor("platformIds") && <p className="field-error">{form.errorFor("platformIds")}</p>}
              </fieldset>
            </>
          )}
          {isAdminRole && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-muted">{t("adminHasAll")}</p>}

          {editing !== "new" && (
            <label className="checkbox-row text-sm">
              <input type="checkbox" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} />
              <span>
                {t("activeLabel")}
                <span className="block text-xs text-text-muted">{t("activeHint")}</span>
              </span>
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={resetting !== null}
        onClose={() => setResetting(null)}
        title={t("resetTitle", { name: resetting?.name ?? "" })}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResetting(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="reset-form" className="btn btn-primary" disabled={reset.pending}>
              {reset.pending ? tc("saving") : t("setPassword")}
            </button>
          </>
        }
      >
        <form id="reset-form" onSubmit={onReset} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-text-muted">{t("resetBody")}</p>
          <FormError message={reset.formError} />
          <Field htmlFor="reset-password" label={t("newPassword")} hint={t("passwordHint")} error={reset.errorFor("password")}>
            <Input id="reset-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} invalid={!!reset.errorFor("password")} />
          </Field>
        </form>
      </Modal>
    </>
  );
}
