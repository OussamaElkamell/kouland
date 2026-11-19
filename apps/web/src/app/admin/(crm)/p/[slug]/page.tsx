"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { CustomerTable } from "@/admin/customers/customer-table";
import { OpportunityTable } from "@/admin/sales/opportunity-table";
import { useCan, useSession } from "@/admin/session";
import { ErrorNotice, PageHeader } from "@/admin/ui";

/**
 * A platform section: the platform's customers, prospects and opportunities. The section exists because the
 * platform is configured in the settings; nothing here knows platform names.
 */
export default function PlatformSectionPage() {
  const t = useTranslations("platformSection");
  const { slug } = useParams<{ slug: string }>();
  const { user } = useSession();
  const { can } = useCan();
  const platform = user.platforms.find((item) => item.slug === slug);
  const tabs = [
    ...(can("CUSTOMERS", "VIEW") ? (["customers"] as const) : []),
    ...(can("SALES", "VIEW") ? (["opportunities"] as const) : []),
  ];
  const [tab, setTab] = useState<(typeof tabs)[number] | undefined>(tabs[0]);

  if (!platform) {
    return (
      <>
        <PageHeader title={t("notFoundTitle")} back={{ href: "/admin", label: t("back") }} />
        <ErrorNotice message={t("notFound")} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin", label: t("back") }}
        title={
          <span className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: platform.color }} aria-hidden="true" />
            {platform.name}
          </span>
        }
        subtitle={t("subtitle")}
        actions={
          <>
            {can("SALES", "EDIT") && (
              <Link href="/admin/sales/new" className="btn btn-primary btn-sm">
                <Icon name="plus" className="h-4 w-4" />
                {t("newOpportunity")}
              </Link>
            )}
            {can("CUSTOMERS", "EDIT") && (
              <Link href="/admin/customers/new" className="btn btn-outline btn-sm">
                <Icon name="plus" className="h-4 w-4" />
                {t("newCustomer")}
              </Link>
            )}
          </>
        }
      />

      {tabs.length > 1 && (
        <div className="mb-4 flex gap-1 border-b" role="tablist">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === item ? "border-brand text-text" : "border-transparent text-text-muted hover:text-text"}`}
            >
              {t(item)}
            </button>
          ))}
        </div>
      )}

      {tab === "customers" && <CustomerTable key={platform.id} platformId={platform.id} />}
      {tab === "opportunities" && <OpportunityTable key={platform.id} platformId={platform.id} />}
      {!tab && <ErrorNotice message={t("noAccess")} />}
    </>
  );
}
