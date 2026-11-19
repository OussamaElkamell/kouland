# Kouland: architecture and decisions

Corporate website (kouland.com) and Kouland CRM (kouland.com/admin) in one modular monorepo.

## Layout

```text
apps/
  web/   Next.js (App Router). [locale]/(site) = public website in en, fr, es. /admin = CRM (from
         Milestone 2), outside [locale], with its own root layout.
  api/   NestJS modular monolith. Owns the Prisma schema and migrations. REST, prefix /api.
packages/
  contracts/   Zod schemas + inferred types for every request and response. Built to dist (CommonJS).
  api-client/  Typed fetch client built on contracts. The only way the frontend talks to the backend.
  ui/          Brand tokens (styles.css), Tailwind preset and React components. Consumed as source.
  config/      Shared tsconfig bases.
```

Build order is handled by Turborepo (`dependsOn: ["^build"]`): contracts → api-client → apps.

## Rules

1. The frontend never accesses the database. It calls the API through `@kouland/api-client`.
2. One set of validation rules. A schema in `contracts` validates the form in the browser and the request
   in the API (`ZodValidationPipe`). Do not re-declare rules on either side.
3. Every API error has the `ApiErrorBody` shape (`statusCode`, `message`, optional `fieldErrors`). The global
   `ApiExceptionFilter` enforces this and hides unexpected errors behind a generic 500.
4. Business rules and permission checks live in the API. Hiding a button in the UI is never the check.
5. Each API module owns its controller, service, validation and data access. Modules do not import each
   other's services in a cycle; shared things (Prisma, common pipes) are in `prisma/` and `common/`.
6. External providers (platform APIs, email, Twilio) sit behind adapters inside the API.
7. A package or abstraction is added when a second caller needs it, not before.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Next.js for the frontend, not React + Vite | The brief and the Milestones document say Next.js; the Technical document's stack table is superseded. |
| 2 | Website first (Milestone 1), CRM after | Follows the Milestones document order, not the Technical document's phase order. |
| 3 | No workflow automation in v1 | Excluded by the brief and the Technical document. Only sync and basic notifications. |
| 4 | Roles: Administrator, Manager, Employee | Confirmed on 2026-11-19. Administrators have everything, including accounts and platform settings. Managers and employees get a level per area (view, edit, or manage = delete) and a set of platforms; employees can be given at most "edit". |
| 5 | Website platform showcase is static content (`apps/web/src/content/platforms.ts`) | The five names are predefined for the website. The CRM reads platforms from the database and never uses this file. |
| 6 | Contact form messages are stored in `contact_messages`, then emailed to `CONTACT_INBOX_EMAIL` (contact@koulandtechnology.com) through Brevo, with the visitor as reply-to | Requested on 2026-11-16. Saved first, so an email failure never loses a message. Brevo sits behind the `MailSender` adapter (`apps/api/src/mail/`); without `BREVO_API_KEY` emails are only logged. |
| 7 | Website in English, French and Spanish, with the language in every address (/en, /fr, /es) | Requested on 2026-11-16. Uses `next-intl`. `/` redirects by browser language. Hreflang links and a per-language sitemap for search engines. |
| 8 | Zod contracts instead of class-validator DTOs | Lets the web app and the API share the same rules and types. |
| 9 | Public write routes are rate limited (`@nestjs/throttler`) | The contact form is public and writes to the database. |
| 10 | No `packages/utils` yet | Nothing is shared by two apps yet. |
| 11 | Ports 3100 (web) and 4100 (api) in development | Avoids clashing with KoulandRoute's 3000/4000 on the same machine. |
| 12 | Careers: a general application (no job listings yet) in five steps, with the step in the URL (`/careers/apply?step=profile`). CVs (PDF or Word, max 5 MB, checked by their content) are stored in the database and emailed to `CAREERS_INBOX_EMAIL` | Requested on 2026-11-17, outside the original documents. Database storage because the host's disk is wiped on every deploy. Job listings and reviewing applications belong in the CRM. |
| 13 | CRM sign-in: database sessions in an httpOnly, SameSite=Lax cookie set by the API; passwords hashed with scrypt (Node built-in) | Sessions can be ended at once (sign-out, deactivation, password change); no JWT to revoke. kouland.com and api.kouland.com are the same site, so the browser sends the cookie. Login is limited to 10 attempts a minute per IP. |
| 14 | Permissions are checked in the API on every request: `CrmGuard` (signed in, area level, admin-only routes) and `platformScope()` in each service (which platforms' records an account may see). Records outside an account's platforms answer 404 | Rule 4. Changes to an account apply on its next request. |
| 15 | Customers are one record per person or company, linked to platforms through `customer_platforms`; prospects are customers with stage PROSPECT. A won opportunity turns its prospect into a customer. Same email twice is refused (409) | "Avoid duplicate customer records" (Requirements §3). |
| 16 | Sales pipeline: New → Contacted → Qualified → Proposal sent → Negotiation → Won / Lost. Proposals: Draft → Sent → Accepted / Rejected | Confirmed on 2026-11-19. |
| 17 | Platforms are rows (`platforms`), added, edited and deactivated by administrators; never deleted. The sidebar, the platform sections (`/admin/p/<slug>`), filters and account permissions all read them | Requirements §3 "Global and Platform Management"; no platform name in CRM code. |
| 18 | The first administrator is created with `pnpm --filter @kouland/api create-admin` | Confirmed on 2026-11-19. No public sign-up. |
| 19 | Other accounts are invited by email: the administrator creates the account without a password, the person opens a one-time link (`/admin/link`, 7 days) and chooses it. Administrators can resend the invitation or send a password link (24 hours); they never see or set passwords. Links are stored hashed (`user_tokens`), a new one replaces the older ones, and using one ends the person's other sessions | Requested on 2026-11-19 ("invite managers", Requirements §4). Without an email provider the administrator gets the link to pass on. |

## Languages

- Every visible text lives in `apps/web/messages/{en,fr,es}.json`, with the same keys in each file. When you add
  text, add its key to all three files.
- `apps/web/src/content/*.ts` only holds what is the same in every language: icons, slugs, numbers, the phone.
- Brand names (KoulandHost…, Kouland Technology, Inc.) and customer names are never translated.
- Validation rules stay in `@kouland/contracts`. The form shows a translated message for each invalid field, so
  the schema's English messages never reach visitors.
- The middleware skips `/admin`. The CRM is also in English, French and Spanish (confirmed on 2026-11-19), but its
  addresses have no language: each account has a language setting, kept in the `kouland_crm_locale` cookie so the
  first render is right. CRM texts are in `apps/web/messages/admin/{en,fr,es}.json`.
- CRM validation messages are codes (`required`, `email`…), turned into sentences by the screen (`errors.field.*`).

## Design

The UI follows the Kouland brand system: dark-first with a light mode, Manrope for headings and Inter for body,
pill buttons. **Each platform has its own colour** (Host green, Route blue, Bot cyan, Event gold, Tech red); the
corporate site uses the parent company's red. Palettes are in `packages/ui/src/platform-palettes.css` and are
chosen with `data-platform`: `parent` on `<html>`, and the platform's key on each platform card, hero tile, service
row and team card, so everything inside takes that platform's colours. Product marks pick their palette from the
monogram. Shared tokens and component classes are in `packages/ui/src/styles.css`.

The header and footer show the official Kouland Technology logo exactly as on koulandtechnology.com
(`apps/web/public/brand/kouland-technology-logo.png`). The favicon and Apple touch icon use its house icon alone
(`apps/web/src/app/[locale]/icon.png` and `apple-icon.png`).

## CRM layout (Milestone 2)

- `apps/web/src/app/admin`: its own root layout. `login/` is public; `(crm)/` needs a session and shows the sidebar.
  Screens are rendered in the browser after `GET /api/auth/me`.
- `apps/web/src/admin`: CRM components (session, shell, forms, tables).
- API modules: `auth` (sign-in, sessions, guard), `users`, `platforms`, `customers` (contacts, notes, history),
  `sales` (opportunities, proposals).

## Open decisions

Before Milestone 3: ticket statuses, priorities, departments; public ticket form or staff
only; in-app or email notifications.

Before Milestone 4: which platforms sync first and their API access; the email provider; the Twilio
account, numbers and call routing; hosting and domain.

Adding a platform in the CRM needs no code. Syncing from a platform whose API has a new shape needs a new
adapter in the API.
