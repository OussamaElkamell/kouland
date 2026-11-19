"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@kouland/ui";
import { useCan } from "@/admin/session";
import { TicketTable } from "@/admin/tickets/ticket-table";
import { PageHeader } from "@/admin/ui";

export default function TicketsPage() {
  const t = useTranslations("tickets");
  const { can } = useCan();
  const add = can("TICKETS", "EDIT") && (
    <Link href="/admin/tickets/new" className="btn btn-primary btn-sm">
      <Icon name="plus" className="h-4 w-4" />
      {t("add")}
    </Link>
  );
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={add} />
      <TicketTable emptyAction={add} />
    </>
  );
}
