import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LegalPage, legalMetadata } from "@/components/legal-page";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return legalMetadata((await params).locale as Locale, "cancellation");
}

export default function Page({ params }: Props) {
  setRequestLocale(use(params).locale as Locale);
  return <LegalPage docKey="cancellation" />;
}
