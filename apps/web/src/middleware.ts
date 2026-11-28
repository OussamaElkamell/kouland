import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Sends visitors without a language in the URL to /en, /fr or /es (from their browser language). */
export default createMiddleware(routing);

export const config = {
  // Skip the CRM (/admin has no language prefix), the API forwarding (/backend), Next internals and files.
  matcher: ["/((?!admin|backend|_next|_vercel|.*\\..*).*)"],
};
