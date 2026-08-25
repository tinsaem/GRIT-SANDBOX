# Deploying GIVT Sandbox on Replit (for Replit Agent / whoever sets this up)

This is a **full-stack** app, not a static site:

- `src/` — React 18 + Vite frontend
- `server/` — Express API, using Prisma against a **PostgreSQL** database

In production, `server/index.js` serves the API **and** the built frontend
(`dist/`) from a single process on one port, so this deploys as **one Replit
service** — no need for two separate deployments.

`.replit` already encodes the commands below. This doc explains *why*, and lists
the secrets a human needs to provide (Replit Agent cannot invent these).

---

## 1. Provision a PostgreSQL database

Use Replit's built-in PostgreSQL (or Neon, Supabase, etc. — any Postgres works).
Whatever you use, you need its connection string as `DATABASE_URL`.

## 2. Set these Secrets (Replit → Secrets pane, not committed to git)

| Key | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | **Yes** | Long random string (32+ chars). `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | No | Defaults to `7d` |
| `CLIENT_URL` | **Yes** | The deployed app's own URL, e.g. `https://<repl-name>.<user>.replit.app` — frontend and API share one origin in production, so this and `SERVER_URL` are the same value |
| `SERVER_URL` | **Yes** | Same value as `CLIENT_URL` (used to build the email-verification link) |
| `PORT` | No | Replit's Autoscale deployments inject this automatically; the app reads `process.env.PORT` |
| `NODE_ENV` | Recommended | `production` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Only if you want real signup emails | See caveat below |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Optional | "Sign in with Google" is disabled gracefully if unset. `GOOGLE_CALLBACK_URL` must match the deployed URL, not localhost — update it here **and** in Google Cloud Console's authorized redirect URIs |
| `ANTHROPIC_API_KEY` | Only if you want the 7 in-app agents (Talent, profile generation, etc.) to work | Powers `server/routes/agent.js`. Without it, agents fall back to heuristic/placeholder output instead of erroring |

`server/.env.example` documents the same variables for local dev.

**Caveat — email/password signup requires working SMTP.** New accounts stay
unverified (and can't log in) until they click the emailed verification link. If
you don't want to wire up SMTP for a demo, skip it and use the seeded demo
accounts instead (step 4) — they're created already-verified.

## 3. Build & run commands (already set in `.replit`)

```
build: npm run setup && npm run db:generate && npm run migrate:deploy && npm run build
run:   npm start
```

- `npm run setup` — installs root (frontend) and `server/` dependencies.
- `npm run db:generate` — generates the Prisma client.
- `npm run migrate:deploy` — applies committed migrations in `server/prisma/migrations/`
  to `DATABASE_URL`. Non-interactive, safe for CI/deploy (unlike `migrate dev`).
- `npm run build` — Vite build, outputs `dist/`.
- `npm start` → `node server/index.js` — starts the API; since `dist/` now
  exists, it also serves the frontend and falls back to `index.html` for
  client-side routes.

Deployment target: **Autoscale** (stateless — all state lives in Postgres).

## 4. Seed demo data (optional but recommended for a first look)

```bash
npm run db:seed
```

Creates one already-verified account per role (Student, Professor, Advisor,
Employer) and a sample company, so the app is immediately explorable:

| Role | Email | Password |
|---|---|---|
| Student | student@givt.demo | `Passw0rd!` |
| Professor | professor@givt.demo | `Passw0rd!` |
| Advisor | advisor@givt.demo | `Passw0rd!` |
| Employer | employer@givt.demo | `Passw0rd!` |

Safe to re-run — it upserts, never duplicates. See `server/prisma/seed.js`.
**Change or remove these accounts before treating a deployment as anything but
a demo** — the password is shared and public in this file.

## 5. Verify it worked

- `GET /api/health` → `{"status":"ok","service":"GIVT API"}`
- `/` → the GIVT homepage
- `/auth` → log in with a seeded account above, or sign up fresh

## Local dev vs. production, in one sentence

Locally, `npm run dev:full` runs Vite (5173) and Express (3000) as two
processes with a dev proxy; in production there is no Vite dev server — the
Express process (`server/index.js`) serves the pre-built `dist/` directory
itself, which is why `CLIENT_URL`/`SERVER_URL` collapse to one URL in
production but differ in `server/.env.example`.
