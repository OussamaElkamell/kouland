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

`start:api` runs `prisma migrate deploy` before starting, so the tables are created and updated on every deploy.

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
