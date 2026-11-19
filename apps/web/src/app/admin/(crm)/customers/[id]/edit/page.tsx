"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CustomerForm } from "@/admin/customers/customer-form";
import { useLoad } from "@/admin/hooks";
import { ErrorNotice, LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

export default function EditCustomerPage() {
  const t = useTranslations("customers");
  const { id } = useParams<{ id: string }>();
  const customer = useLoad(() => api.customers.get(id), [id]);

  if (customer.error) return <ErrorNotice message={customer.error.message} onRetry={customer.reload} />;
  if (!customer.data) return <LoadingRows />;
  const c = customer.data;
  return (
    <>
      <PageHeader title={t("edit", { name: c.displayName })} back={{ href: `/admin/customers/${id}`, label: c.displayName }} />
      <CustomerForm
        customerId={id}
        initial={{
          type: c.type,
          stage: c.stage,
          firstName: c.firstName ?? "",
          lastName: c.lastName ?? "",
          companyName: c.companyName ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          website: c.website ?? "",
          addressLine: c.addressLine ?? "",
          city: c.city ?? "",
          region: c.region ?? "",
          postalCode: c.postalCode ?? "",
          country: c.country ?? "",
          notes: c.notes ?? "",
        }}
        initialPlatformIds={c.platforms.map((platform) => platform.id)}
      />
    </>
  );
}
