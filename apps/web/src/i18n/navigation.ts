import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Use these instead of next/link and next/navigation on the website, so links keep the current language. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
