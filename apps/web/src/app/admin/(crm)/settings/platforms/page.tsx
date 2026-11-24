"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { slugify, type Platform } from "@kouland/contracts";
import { Field, Icon, Input, Textarea } from "@kouland/ui";
import { useLoad, useSubmit } from "@/admin/hooks";
import { useCan, useSession } from "@/admin/session";
import { Badge, EmptyState, ErrorNotice, FormError, LoadingRows, Modal, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

interface Values {
  name: string;
  slug: string;
  description: string;
  websiteUrl: string;
  color: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY: Values = { name: "", slug: "", description: "", websiteUrl: "", color: "#64748B", sortOrder: "0", isActive: true };

/**
 * Administrators add, edit, deactivate and reactivate platform sections. Every CRM menu, filter and permission
 * reads this list, so a new platform needs no code change.
 */
export default function PlatformSettingsPage() {
  const t = useTranslations("platformSettings");
  const tc = useTranslations("common");
  const { isAdmin } = useCan();
  const { refresh } = useSession();
  const platforms = useLoad(() => api.platforms.list(true), []);
  const form = useSubmit();
  const [editing, setEditing] = useState<Platform | "new" | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  if (!isAdmin) return <ErrorNotice message={t("adminOnly")} />;

  function open(platform: Platform | "new") {
    setSlugTouched(platform !== "new");
    setValues(
      platform === "new"
        ? { ...EMPTY, sortOrder: String((platforms.data?.length ?? 0) * 10) }
        : {
            name: platform.name,
            slug: platform.slug,
            description: platform.description ?? "",
            websiteUrl: platform.websiteUrl ?? "",
            color: platform.color,
            sortOrder: String(platform.sortOrder),
            isActive: platform.isActive,
          },
    );
    setEditing(platform);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { ...values, sortOrder: Number(values.sortOrder) || 0 };
    const saved = await form.submit(() => (editing === "new" ? api.platforms.create(input) : api.platforms.update((editing as Platform).id, input)));
    if (saved) {
      setEditing(null);
      await Promise.all([platforms.reload(), refresh()]);
    }
  }

  async function toggleActive(platform: Platform) {
    const saved = await form.submit(() => api.platforms.update(platform.id, { isActive: !platform.isActive }));
    if (saved) await Promise.all([platforms.reload(), refresh()]);
  }

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
      {form.formError && !editing && (
        <div className="mb-4">
          <ErrorNotice message={form.formError} />
        </div>
      )}

      <div className="card overflow-hidden">
        {platforms.error ? (
          <div className="p-4">
            <ErrorNotice message={platforms.error.message} onRetry={platforms.reload} />
          </div>
        ) : !platforms.data ? (
          <LoadingRows rows={4} />
        ) : platforms.data.length === 0 ? (
          <EmptyState icon="globe" title={t("empty")} body={t("emptyBody")} />
        ) : (
          <ul className="divide-y">
            {platforms.data.map((platform) => (
              <li key={platform.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${platform.isActive ? "" : "opacity-60"}`}>
                <span className="h-4 w-4 flex-none rounded-full" style={{ background: platform.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {platform.name}
                    {!platform.isActive && <Badge>{t("inactive")}</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">
                    /admin/p/{platform.slug} · {t("counts", { customers: platform.customerCount, opportunities: platform.opportunityCount })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/settings/platforms/${platform.id}`} className="btn btn-outline btn-sm">
                    <Icon name="server" className="h-4 w-4" />
                    {t("integration")}
                  </Link>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => open(platform)}>
                    <Icon name="pencil" className="h-4 w-4" />
                    {tc("edit")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleActive(platform)} disabled={form.pending}>
                    {platform.isActive ? t("deactivate") : t("activate")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-text-muted">{t("deactivateHint")}</p>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("add") : t("edit")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </button>
            <button type="submit" form="platform-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? tc("saving") : tc("save")}
            </button>
          </>
        }
      >
        <form id="platform-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={form.formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="platform-name" label={t("name")} error={form.errorFor("name")}>
              <Input
                id="platform-name"
                value={values.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setValues((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
                }}
                invalid={!!form.errorFor("name")}
              />
            </Field>
            <Field htmlFor="platform-slug" label={t("slug")} hint={t("slugHint")} error={form.errorFor("slug")}>
              <Input
                id="platform-slug"
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                invalid={!!form.errorFor("slug")}
              />
            </Field>
          </div>
          <Field htmlFor="platform-description" label={t("description")} optionalLabel={tc("optional")} error={form.errorFor("description")}>
            <Textarea id="platform-description" rows={2} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field htmlFor="platform-url" label={t("websiteUrl")} optionalLabel={tc("optional")} error={form.errorFor("websiteUrl")}>
            <Input id="platform-url" value={values.websiteUrl} placeholder="https://" onChange={(e) => set("websiteUrl", e.target.value)} invalid={!!form.errorFor("websiteUrl")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="platform-color" label={t("color")} error={form.errorFor("color")}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label={t("color")}
                  value={/^#[0-9a-f]{6}$/i.test(values.color) ? values.color : "#64748B"}
                  onChange={(e) => set("color", e.target.value.toUpperCase())}
                  className="h-11 w-14 flex-none cursor-pointer rounded-md border bg-surface p-1"
                />
                <Input id="platform-color" value={values.color} onChange={(e) => set("color", e.target.value)} invalid={!!form.errorFor("color")} />
              </div>
            </Field>
            <Field htmlFor="platform-order" label={t("sortOrder")} hint={t("sortOrderHint")} error={form.errorFor("sortOrder")}>
              <Input id="platform-order" type="number" min={0} value={values.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            </Field>
          </div>
          <label className="checkbox-row text-sm">
            <input type="checkbox" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            {t("active")}
          </label>
        </form>
      </Modal>
    </>
  );
}
