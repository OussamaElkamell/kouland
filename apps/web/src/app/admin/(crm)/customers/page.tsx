"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { CustomerTable } from "@/admin/customers/customer-table";
import { useCan } from "@/admin/session";
import { PageHeader } from "@/admin/ui";

export default function CustomersPage() {
  const t = useTranslations("customers");
  const { can } = useCan();
  const add = can("CUSTOMERS", "EDIT") && (
    <Link href="/admin/customers/new" className="btn btn-primary btn-sm">
      <Icon name="plus" className="h-4 w-4" />
      {t("add")}
    </Link>
  );
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={add} />
      <CustomerTable emptyAction={add} />
    </>
  );
}
