"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLoad } from "@/admin/hooks";
import { OpportunityForm } from "@/admin/sales/opportunity-form";
import { ErrorNotice, LoadingRows, PageHeader } from "@/admin/ui";
import { api } from "@/lib/api";

export default function EditOpportunityPage() {
  const t = useTranslations("sales");
  const { id } = useParams<{ id: string }>();
  const opportunity = useLoad(() => api.opportunities.get(id), [id]);

  if (opportunity.error) return <ErrorNotice message={opportunity.error.message} onRetry={opportunity.reload} />;
  if (!opportunity.data) return <LoadingRows />;
  const o = opportunity.data;
  return (
    <>
      <PageHeader title={t("edit")} subtitle={o.customer.name} back={{ href: `/admin/sales/${id}`, label: o.title }} />
      <OpportunityForm
        opportunityId={id}
        initial={{
          title: o.title,
          platformId: o.platform.id,
          status: o.status,
          source: o.source,
          request: o.request ?? "",
          estimatedValue: o.estimatedValue === null ? "" : String(o.estimatedValue),
          currency: o.currency,
          expectedCloseDate: o.expectedCloseDate ?? "",
          ownerId: o.owner?.id ?? "",
          lostReason: o.lostReason ?? "",
        }}
      />
    </>
  );
}
