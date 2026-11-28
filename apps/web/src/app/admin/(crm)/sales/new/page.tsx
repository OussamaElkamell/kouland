"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLoad } from "@/admin/hooks";
import { OpportunityForm } from "@/admin/sales/opportunity-form";
import { LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

/** `?customer=<id>` starts the form for that customer (from the customer's page). */
function NewOpportunity() {
  const customerId = useSearchParams().get("customer");
  const customer = useLoad(async () => (customerId ? api.customers.get(customerId) : null), [customerId]);
  if (customerId && customer.loading) return <LoadingRows />;
  const initial = customer.data ? { id: customer.data.id, name: customer.data.displayName } : null;
  return <OpportunityForm initialCustomer={initial} />;
}

export default function NewOpportunityPage() {
  const t = useTranslations("sales");
  return (
    <>
      <PageHeader title={t("add")} subtitle={t("addSubtitle")} back={{ href: "/admin/sales", label: t("title") }} />
      <Suspense fallback={<LoadingRows />}>
        <NewOpportunity />
      </Suspense>
    </>
  );
}
