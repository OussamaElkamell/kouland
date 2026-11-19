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
  type LinkReceipt,
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
  const linkAction = useSubmit();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  /** What happened to the last invitation or password link: shown so the administrator knows it went out. */
  const [sent, setSent] = useState<{ name: string; email: string; invite: boolean; receipt: LinkReceipt } | null>(null);
  const [copied, setCopied] = useState(false);
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
    if (editing === "new") {
      const created = await form.submit(() => api.users.create({ ...shared, email: values.email }));
      if (!created) return;
      setEditing(null);
      showSent({ name: created.user.name, email: created.user.email, invite: true, receipt: created.invitation });
    } else {
      const saved = await form.submit(() => api.users.update((editing as User).id, { ...shared, isActive: values.isActive }));
      if (!saved) return;
      setEditing(null);
    }
    await users.reload();
  }

  function showSent(result: NonNullable<typeof sent>) {
    setCopied(false);
    setSent(result);
  }

  /** A new invitation while the person has never signed in, otherwise a link to choose a new password. */
  async function sendLink(user: User) {
    const receipt = await linkAction.submit(() => api.users.sendLink(user.id));
    if (receipt) showSent({ name: user.name, email: user.email, invite: user.invitationPending, receipt });
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* the link stays visible to copy by hand */
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
                    {user.isActive && user.invitationPending && <Badge tone="warning">{t("pending")}</Badge>}
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
                  <p className="mt-1 text-xs text-text-faint">
                    {user.invitationPending ? t("pendingHint") : t("lastLogin", { date: user.lastLoginAt ? format.dateTime(user.lastLoginAt) : t("never") })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => open(user)}>
                    <Icon name="pencil" className="h-4 w-4" />
                    {tc("edit")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sendLink(user)} disabled={!user.isActive || linkAction.pending}>
                    {user.invitationPending ? t("resendInvite") : t("sendPasswordLink")}
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
              {form.pending ? tc("saving") : editing === "new" ? t("sendInvite") : tc("save")}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <FormError message={form.formError} />
          {editing === "new" && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-muted">{t("inviteNote")}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="user-name" label={t("name")} error={form.errorFor("name")}>
              <Input id="user-name" value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!form.errorFor("name")} />
            </Field>
            <Field htmlFor="user-email" label={t("email")} error={form.errorFor("email")} hint={editing !== "new" ? t("emailFixed") : undefined}>
              <Input id="user-email" type="email" value={values.email} disabled={editing !== "new"} onChange={(e) => set("email", e.target.value)} invalid={!!form.errorFor("email")} />
            </Field>
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
        open={sent !== null}
        onClose={() => setSent(null)}
        title={sent ? t(sent.receipt.emailSent ? (sent.invite ? "inviteSentTitle" : "linkSentTitle") : sent.invite ? "inviteReadyTitle" : "linkReadyTitle") : ""}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setSent(null)}>
            {tc("close")}
          </button>
        }
      >
        {sent &&
          (sent.receipt.emailSent ? (
            <p className="text-sm text-text-muted">{t(sent.invite ? "inviteSentBody" : "linkSentBody", { name: sent.name, email: sent.email })}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">{t("notSentBody", { name: sent.name })}</p>
              {sent.receipt.link && (
                <div className="flex gap-2">
                  <input className="input text-xs" readOnly value={sent.receipt.link} aria-label={t("linkLabel")} onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn btn-outline btn-sm flex-none" onClick={() => void copyLink(sent.receipt.link!)}>
                    {copied ? t("copied") : t("copy")}
                  </button>
                </div>
              )}
              <p className="text-xs text-text-faint">{t(sent.invite ? "inviteValid" : "resetValid")}</p>
            </div>
          ))}
      </Modal>
      {linkAction.formError && !sent && (
        <div className="mt-4">
          <ErrorNotice message={linkAction.formError} />
        </div>
      )}
    </>
  );
}
