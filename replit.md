# GIVT Sandbox

**Gamified · Individualized · Verified Talent**
Seven-agent educational workforce platform — Kennesaw State University · Healthcare Informatics MVP · 2026.

Full-stack app: React 18 + Vite frontend · Express API · Prisma + Replit PostgreSQL · JWT auth + Google OAuth.

## How to run

The **Start application** workflow runs automatically and handles first-time setup:

```
npm run dev:bootstrap && npm run dev:full
```

`dev:bootstrap` runs on every start and is fully idempotent:
1. `npm run setup` — installs root + server dependencies
2. `npm run migrate:deploy` — applies any pending Prisma migrations against the database
3. `npm run db:seed` — upserts demo accounts (safe to re-run; never duplicates)

After bootstrap, `dev:full` starts Vite (port 5000) + Express API (port 3000) together. The Vite dev server proxies `/api/*` to Express. Open the Preview pane — it points at port 5000.

## Demo accounts (password: `Passw0rd!`)

| Role      | Email                   |
|-----------|-------------------------|
| Student   | student@givt.demo       |
| Professor | professor@givt.demo     |
| Advisor   | advisor@givt.demo       |
| Employer  | employer@givt.demo      |
| Student   | peer@givt.demo          |
| Admin     | admin@givt.demo         |

Re-seed at any time: `npm run db:seed` (safe to re-run — upserts).

## Environment variables (already configured)

All required secrets are set in Replit Secrets / env vars:
- `DATABASE_URL` — Replit's built-in PostgreSQL (runtime-managed)
- `JWT_SECRET` / `JWT_EXPIRES_IN`
- `CLIENT_URL` / `SERVER_URL` — dev & production environments configured
- `SMTP_HOST/PORT/USER/PASS` / `EMAIL_FROM` — Gmail SMTP for verification emails
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`

Optional (not yet set): `ANTHROPIC_API_KEY` — enables live AI in the 7 agents (Talent profile generation, etc.); without it they fall back to heuristic output.

## Key files

```
src/
  App.jsx              # React router: HomePage / AuthPage / dashboard
  AuthContext.jsx      # JWT session (localStorage-backed)
  GIVTDashboard.jsx    # The seven agents + account dashboard
  api.js               # Axios client
server/
  index.js             # Express entry — mounts routes, serves dist/ in prod
  routes/              # auth, users, tokens, verifications, companies, syllabi, leaderboard, gan, agent
  prisma/
    schema.prisma      # Data model
    seed.js            # Demo accounts
    migrations/        # Schema history
```

## Build & deploy

```
npm run build            # Vite build → dist/
npm run migrate:deploy   # Apply migrations (non-interactive, safe for prod)
npm start                # node server/index.js — serves API + dist/ on $PORT
```

Deploy as a single Autoscale service. See `REPLIT_DEPLOY.md` for full details.

## User preferences

<!-- Agent: add user preferences here when asked to remember something -->
