# Deploying Kouland

Two services from this one repository, plus a PostgreSQL database:

| Service | Address | Build command | Start command | Health check |
|---|---|---|---|---|
| **api** | `https://api.kouland.com` | `pnpm run build:api` | `pnpm run start:api` | `/api/health` |
| **web** | `https://kouland.com` | `pnpm run build:web` | `pnpm run start:web` | `/en` |
| **database** | managed PostgreSQL | — | — | — |

## Railway

Create both services from the same GitHub repository and give each one these settings:

| Setting | api | web |
|---|---|---|
| Root Directory | *(empty: the repository root)* | *(empty: the repository root)* |
| Config file path (Settings → Config-as-code) | `/apps/api/railway.json` | `/apps/web/railway.json` |

The config files set the builder, build and start commands, the health check and which file changes trigger a
redeploy. If a service has its own Build Command in Railway's settings, that one wins over the config file; the
equivalent `pnpm --filter @kouland/web build` / `pnpm --filter @kouland/api build` also work, because each app's
`build` script first builds the shared packages it imports (`packages/contracts`, `packages/api-client`). Keep the root directory empty: both apps need the shared packages in `packages/` and the lockfile at
the root.

Do **not** set `NODE_ENV`. Railway passes service variables to the build too, and with `NODE_ENV=production` pnpm
skips dev dependencies, which the build needs (Nest CLI, Prisma CLI, TypeScript, Tailwind). It is not needed at
run time either: `next start` always serves the production build, and the API only uses `NODE_ENV` for defaults
that the variables below set explicitly (`CORS_ORIGINS`, `TRUST_PROXY`).

Both services listen on the port Railway gives them (`PORT`).

## Before each deploy

- Commit `pnpm-lock.yaml` whenever dependencies change. Build servers refuse to modify the lockfile.
- The pnpm version is pinned in the root `package.json` (`packageManager`).
- `.env` files are git-ignored. Put the values below in the host's variables instead.

## API variables (`api.kouland.com`)

| Variable | Value |
|---|---|
| `DATABASE_URL` | The PostgreSQL connection string (on Railway: reference the database's `DATABASE_URL`) |
| `CORS_ORIGINS` | `https://kouland.com,https://www.kouland.com` |
| `BREVO_API_KEY` | Brevo API key |
| `MAIL_FROM_EMAIL` | `noreply@kouland.com` (kouland.com must be verified in Brevo) |
| `MAIL_FROM_NAME` | `Kouland Technology` |
| `CONTACT_INBOX_EMAIL` | `contact@koulandtechnology.com` |
| `CAREERS_INBOX_EMAIL` | Optional. Inbox for job applications (CV attached). Defaults to `CONTACT_INBOX_EMAIL` |
| `TRUST_PROXY` | `1` (Railway's proxy). Use `2` if Cloudflare is also in front. Needed so rate limits count each visitor separately |

| `COOKIE_SECURE` | Optional. The CRM session cookie is HTTPS-only when the request came over HTTPS (needs `TRUST_PROXY`); `true` forces it |
| `CRM_TIME_ZONE` | Optional. Time zone used to word dates in notification emails. Default `America/Chicago` |
| `REMINDERS` | Optional. `off` stops the task and appointment reminder worker on this instance |
| `APP_URL` | The website's address, e.g. `https://kouland.com`: invitation and password emails link to `APP_URL/admin/link`. Defaults to the first `CORS_ORIGINS` entry |
| `COOKIE_DOMAIN` | Optional. Leave empty; `kouland.com` would also send the CRM cookie to the website |
| `INTEGRATIONS_KEY` | 64 hex characters (32 random bytes) that encrypt webhook secrets and mailbox tokens. Generate it once (`openssl rand -hex 32`) and keep it: changing it makes every stored secret unreadable (platforms need a new secret, people reconnect their mailbox) |
| `PUBLIC_API_URL` | `https://api.kouland.com`: the API's address as platforms, Twilio, Google and Microsoft reach it (without `/api`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio account and the company number (`+1…`). See "Phone (Twilio)" below |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Workspace mailboxes. See "Email" below |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Microsoft 365 mailboxes. See "Email" below |

`start:api` runs `prisma migrate deploy` before starting, so the tables are created and updated on every deploy.

## First CRM administrator

The CRM (`https://kouland.com/admin`) has no sign-up page. Create the first administrator once, from the **api**
service's console in Railway (not the web one: only the api has `apps/api/dist`). Check first with
`echo $RAILWAY_SERVICE_NAME $RAILWAY_ENVIRONMENT_NAME`. The container has neither `pnpm` nor `node` on its PATH;
Node is under `/mise/installs/node/<version>/bin/node`:

```sh
cd /app/apps/api && $(ls -d /mise/installs/node/*/bin/node | tail -1) dist/cli/create-admin.js
```

If it says a table does not exist, the database has no tables yet; create them, then run it again:

```sh
cd /app/apps/api && $(ls -d /mise/installs/node/*/bin/node | tail -1) node_modules/prisma/build/index.js migrate deploy
```

On your own computer, `pnpm --filter @kouland/api create-admin` does the same with the `DATABASE_URL` in
`apps/api/.env`. It asks for the email, name and password (at least 10 characters). On a server without a terminal, pass
`--email` and `--name` and put the password in `ADMIN_PASSWORD` for that one command. Running it again for the
same email resets that account's password and makes it an administrator. Every other account is then created in
the CRM under **Settings → Accounts**: the person receives an invitation email (through Brevo) and chooses their own
password. Without `BREVO_API_KEY` the CRM shows the administrator the link to pass on instead.

## Platform sync (webhooks)

Nothing to set up on the server besides `INTEGRATIONS_KEY` and `PUBLIC_API_URL`. In the CRM, **Settings → Platform
settings → Integration** on a platform: turn it on, then give its developers the webhook address and the signing
secret (privately). The page shows ready-to-copy code (Node.js, PHP, Python, curl) and the events received.

## Email (Google Workspace and Microsoft 365)

Each person connects their own mailbox on **My account**. The server needs an OAuth app for each provider you use:

**Google Workspace** (Google Cloud console, signed in with a Workspace administrator):
1. Create a project, enable the **Gmail API**.
2. OAuth consent screen: user type **Internal** (only the company's accounts; no Google review needed). Scopes:
   `gmail.readonly`, `gmail.send`, `openid`, `email`.
3. Credentials → OAuth client ID → **Web application**. Authorised redirect URI:
   `<PUBLIC_API_URL>/api/email/oauth/google/callback`.
4. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Microsoft 365** (Microsoft Entra admin center → App registrations → New registration):
1. Supported account types: **this organisation only**. Redirect URI (Web):
   `<PUBLIC_API_URL>/api/email/oauth/microsoft/callback`.
2. Certificates & secrets → new client secret. API permissions → Microsoft Graph, delegated: `Mail.Read`,
   `Mail.Send`, `User.Read`, `offline_access` → **Grant admin consent**.
3. Put the application (client) id, the secret value and the directory (tenant) id in `MICROSOFT_CLIENT_ID`,
   `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID`.

## Phone (Twilio)

1. In Twilio, buy or port the company number. Put the Account SID, the Auth Token and the number (`+1…`) in
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER`, and redeploy the API.
2. In the CRM, **Settings → Phone** shows three addresses. In the Twilio console (Phone Numbers → Manage → Active
   numbers → the company number): **A call comes in** = the voice address (HTTP POST), **Call status changes** = the
   status address, **A message comes in** = the SMS address (HTTP POST).
3. On the same CRM page, set the **default number** (reception or a manager's phone) and the ring time.
4. Each employee adds their phone number on **My account**: calls from their customers ring it, and **Call** on a
   customer's page rings it first.

The addresses must match `PUBLIC_API_URL` exactly: Twilio signs each request with the address it called, and the CRM
refuses requests whose signature does not match.

## Website variables (`kouland.com`), set **before** the build

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.kouland.com/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://kouland.com` |

These are written into the site when it is built: after changing one, redeploy (rebuild), a restart is not enough.

## After deploying

1. `https://api.kouland.com/api/health` answers `{"status":"ok"}` (this also checks the database connection).
2. `https://kouland.com` redirects to `/en` and shows the site.
3. Send a message from the contact page and check that it reaches `contact@koulandtechnology.com`.
4. `https://kouland.com/admin` shows the CRM sign-in page; sign in with the administrator created above.

## Staging on Railway addresses only (`*.up.railway.app`)

To test a branch like production without touching it, create a second Railway environment (environment menu →
**New Environment** → duplicate `production`, name it `staging`). In `staging`:

1. In each service's **Settings**, connect the branch to test (for example `m2-crm-foundation`). Never change the
   branch of the `production` environment.
2. Add a PostgreSQL database to `staging` and point the api's `DATABASE_URL` at it, never at production's.
3. Generate a public domain for the web service (Settings → Networking). The api does not need a public domain.
4. Set the variables below, then redeploy both services.

Browsers treat two `*.up.railway.app` addresses as two unrelated sites (`up.railway.app` is a public suffix), so a
CRM sign-in cookie set by the api's address would never be sent. On staging the website therefore forwards
`/backend/*` to the api over Railway's private network, and the browser only talks to the website's address.

| Service | Variable | Value |
|---|---|---|
| web | `API_PROXY_TARGET` | `http://<api private domain>:8080`, e.g. `http://koulandapi.railway.internal:8080` (no `/api`). Get the domain with `echo $RAILWAY_PRIVATE_DOMAIN` in the api's console, or from its Settings → Networking. Type it in: a `${{service.VAR}}` reference resolves to nothing when the service name does not match exactly |
| web | `NEXT_PUBLIC_API_URL` | `/backend/api` |
| web | `NEXT_PUBLIC_SITE_URL` | the web service's `https://….up.railway.app` address |
| api | `DATABASE_URL` | the staging database's `DATABASE_URL` |
| api | `PORT` | `8080` (fixed, so the web service can reach it at a known port) |
| api | `TRUST_PROXY` | `2` (Railway's proxy, then the website forwarding) |
| api | `COOKIE_SECURE` | `true` (the forwarded request reaches the api over plain HTTP inside Railway) |
| api | `CORS_ORIGINS` | the web address (not used by the forwarding, but keeps direct calls working) |
| api | `BREVO_API_KEY` | leave empty: staging only logs emails; invitations then show the link to copy |
| api | `APP_URL` | the web address (invitation links point to it) |
| api | `PUBLIC_API_URL` | the web address followed by `/backend`, e.g. `https://koulandweb-staging.up.railway.app/backend` (webhooks, Twilio and mailbox sign-in returns go through the website's forwarding) |
| api | `INTEGRATIONS_KEY` | its own 64 hex characters (not production's) |

All `web` values are read during the build: change them, then redeploy. The api's start command must stay
`pnpm run start:api` (Settings → Deploy → Custom Start Command empty or set to that): it creates the tables before
starting. Then create the first administrator from the **api** service's console (see "First CRM administrator")
and sign in at `<web address>/admin`.

Check the forwarding from the **web** service's console; it should print the address, then `{"status":"ok"}`:

```sh
echo $API_PROXY_TARGET; $(ls -d /mise/installs/node/*/bin/node | tail -1) -e "fetch(process.env.API_PROXY_TARGET+'/api/health').then(r=>r.text()).then(console.log,e=>console.error(e.cause||e))"
```

`http://:` or `undefined` means `API_PROXY_TARGET` is empty; `ENOTFOUND` a wrong private domain; `ECONNREFUSED`
that the api is not running on that port.
