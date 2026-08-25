# GIVT — Quick Start

Complete project with the new **Admin / User Management** module included.

---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **PostgreSQL 18** running locally, with pgAdmin4
- A database named **`givt-db`** (create it in pgAdmin: right-click Databases → Create → Database)

---

## Run it

Open PowerShell in this folder (the one containing this file) and run:

```
npm run setup
npm run migrate
npm run db:seed
npm run dev:full
```

Then open **http://localhost:5173**

That's it. `npm run setup` installs both frontend and backend, `migrate` builds the
database schema, `db:seed` creates demo accounts and sample advising records, and
`dev:full` starts both servers. The seed is development-only and refuses to run
when `NODE_ENV=production`.

---

## Log in

| Email | Role | Password |
|---|---|---|
| `admin@givt.demo` | **Admin** | `Passw0rd!` |
| `student@givt.demo` | Student | `Passw0rd!` |
| `professor@givt.demo` | Professor | `Passw0rd!` |
| `advisor@givt.demo` | Advisor | `Passw0rd!` |
| `employer@givt.demo` | Employer | `Passw0rd!` |
| `peer@givt.demo` | Peer | `Passw0rd!` |

Signing in as **admin** takes you straight to the administration console at `/admin`.
The other roles get the usual agent workspace at `/dashboard`.

---

## Database password

`server/.env` assumes your PostgreSQL `postgres` role password is **`123`**:

```
DATABASE_URL=postgresql://postgres:123@localhost:5432/givt-db
```

If yours differs, edit that line. If the password has special characters, URL-encode
them: `@` → `%40`, `#` → `%23`, `:` → `%3A`, `/` → `%2F`.

To set the password to `123`, run this in the pgAdmin Query Tool:

```sql
ALTER USER postgres WITH PASSWORD '123';
```

---

## Commands

Run all of these from **this folder**, not from `server/`.

| Command | Purpose |
|---|---|
| `npm run dev:full` | Frontend + backend together |
| `npm run dev` | Frontend only (port 5173) |
| `npm run server:dev` | Backend only (port 3000) |
| `npm run migrate` | Apply schema migrations |
| `npm run db:seed` | Create/refresh demo accounts and sample advising records |
| `npm run db:studio` | Visual database browser |
| `npm run build` | Production frontend build |

---

## Troubleshooting

**`Missing script: "setup"`** — you're in `server/`. Run `cd ..` first.

**`P1000: Authentication failed`** — the `postgres` password in `server/.env` doesn't match
your server. Fix with the `ALTER USER` statement above.

**`Can't reach database server`** — PostgreSQL isn't running:
```
Get-Service -Name postgresql*
Start-Service postgresql-x64-18
```

**Migration fails on the `Role` enum** — run this once in pgAdmin, then delete that line
from `server/prisma/migrations/20260725140000_add_admin_role_user_status_audit/migration.sql`
and re-run `npm run migrate`:
```sql
ALTER TYPE "Role" ADD VALUE 'Admin';
```

**`npx` says "Need to install the following packages"** — stop. That means a local
dependency is missing and npx is about to fetch a *different version* than the project
expects. Run `npm run setup` instead.

**Port already in use** — something else holds 3000 or 5173:
```
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
```

---

## Two notes before you commit

**`server/.env` is included** so this package runs immediately. It contains a local
database password and a freshly generated `JWT_SECRET`. `.gitignore` already excludes
it, but verify before your first push:

```
git check-ignore server/.env
```

If that prints the path, you're protected. Given this repo has already triggered a
GitGuardian alert, it's worth the ten seconds.

**SMTP is still on placeholders**, so verification emails won't send. This doesn't block
you: seeded accounts are pre-verified, and users created through the admin console are
pre-verified by default. Fill in real SMTP credentials when you want self-service signup
to work.

---

## What's new in this build

See **`ADMIN_MODULE_SETUP.md`** for the full write-up. Summary:

- New `Admin` role with a four-tab console: Overview, User Management, Analytics, Audit Log
- Register users by role; activate, deactivate, edit, delete, reset passwords; bulk actions
- Analytics with charts (role distribution, growth trends, account health)
- Export to CSV, Excel, and PDF
- Audit trail of every administrative action
- Deactivated users are blocked at login; `lastLoginAt` is tracked

**No new npm dependencies** — charts are hand-written SVG, exports use native browser APIs.
