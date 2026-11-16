import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="glow-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("body")}</p>
      <Link href="/" className="btn btn-primary mt-2">
        {t("home")}
      </Link>
    </main>
  );
}
