"use client";

import { useTranslations } from "next-intl";
import { CustomerForm } from "@/admin/customers/customer-form";
import { PageHeader } from "@/admin/ui";

export default function NewCustomerPage() {
  const t = useTranslations("customers");
  return (
    <>
      <PageHeader title={t("add")} back={{ href: "/admin/customers", label: t("title") }} />
      <CustomerForm />
    </>
  );
}
