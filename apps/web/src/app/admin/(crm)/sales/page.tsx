"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { OpportunityTable } from "@/admin/sales/opportunity-table";
import { useCan } from "@/admin/session";
import { PageHeader } from "@/admin/ui";

export default function SalesPage() {
  const t = useTranslations("sales");
  const { can } = useCan();
  const add = can("SALES", "EDIT") && (
    <Link href="/admin/sales/new" className="btn btn-primary btn-sm">
      <Icon name="plus" className="h-4 w-4" />
      {t("add")}
    </Link>
  );
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={add} />
      <OpportunityTable emptyAction={add} />
    </>
  );
}
