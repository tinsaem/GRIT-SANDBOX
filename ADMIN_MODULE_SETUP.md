# GIVT — Admin / User Management Module

A new `Admin` role with a full administration console: user CRUD, activate/deactivate,
analytics with charts, exports, and an audit trail.

**No new npm dependencies.** Charts are hand-written SVG; exports use native browser
APIs. Nothing to install, nothing to version-align.

---

## Files

### New
| Path | Purpose |
|---|---|
| `server/routes/admin.js` | Admin-only API: users, stats, audit, export |
| `server/prisma/migrations/20260725140000_add_admin_role_user_status_audit/migration.sql` | Schema migration |
| `src/pages/AdminDashboard.jsx` | The console (4 tabs) |
| `src/components/Charts.jsx` | Donut / bar / area / sparkline, dependency-free |
| `src/components/exportUtils.js` | CSV, Excel, PDF generation |

### Modified
| Path | Change |
|---|---|
| `server/prisma/schema.prisma` | `Admin` enum value; `isActive`, `lastLoginAt`, `deactivatedAt`, `deactivatedReason` on User; new `AuditLog` model; indexes |
| `server/index.js` | Mounts `/api/admin` |
| `server/routes/auth.js` | Blocks deactivated accounts at login; records `lastLoginAt` |
| `server/prisma/seed.js` | Seeds `admin@givt.demo` |
| `src/api.js` | Adds `adminAPI` |
| `src/App.jsx` | `/admin` route; admins redirected there from `/dashboard` |

---

## Install

Copy the files over your project, preserving paths. Then, from the **project root**:

```
npm run migrate
npm run db:seed
npm run dev:full
```

Sign in at http://localhost:5173 with:

**`admin@givt.demo`** / **`Passw0rd!`**

You land on `/admin` automatically.

### If the migration fails on the enum

Prisma runs migrations in a transaction. PostgreSQL 12+ permits `ALTER TYPE ... ADD VALUE`
there (you're on 18, so this should be fine), but if your server objects, run this once in
the pgAdmin Query Tool against `givt-db`:

```sql
ALTER TYPE "Role" ADD VALUE 'Admin';
```

Then delete that line from `migration.sql` and re-run `npm run migrate`.

---

## What the console does

**Overview** — six stat cards (total, active, deactivated, unverified, active last 7 days,
tokens in circulation), a role donut, a registration trend line, a role bar chart, and recent
signups. Period selector: 7 / 30 / 90 / 365 days.

**User Management** — paginated, sortable table with debounced search and filters on role,
status, and verification. Per-row: edit, reset password, activate/deactivate, delete.
Multi-select for bulk activate / deactivate / delete. Export buttons respect active filters.

**Analytics** — cumulative growth, daily registrations, role composition, account health,
plus platform counts (verifications, syllabi, companies, messages) and an export panel.

**Audit Log** — every administrative mutation with actor, action, target, details, IP, timestamp.

---

## Design decisions worth knowing

**Deactivate is the default; delete is deliberately awkward.** Deactivation blocks login while
preserving tokens, verifications, syllabi, and messages. Deletion cascades and destroys all of
it, so the modal requires typing `DELETE` and offers "Deactivate instead" as an escape.

**Two lockout guards, enforced server-side.** An admin cannot deactivate, delete, or demote
their own account; and the last active admin cannot be removed by anyone. Bulk operations skip
blocked rows and report them rather than failing the batch. These live in `guardDestructive()`
in `admin.js` — client-side disabling is only cosmetic.

**Admin-created accounts are pre-verified.** Since your SMTP is still on placeholders,
verification emails don't send and new users can't log in. Admin registration bypasses this
with `emailVerified: true` by default — this is the practical way to onboard users right now.

**Self-signup cannot create admins.** `VALID_ROLES` in `auth.js` excludes `Admin`; only an
existing admin can mint another via `POST /api/admin/users`.

**Passwords are never returned.** The `USER_SELECT` projection omits `passwordHash` and raw
tokens on every route.

**Export formats.** CSV is UTF-8 with BOM (so Excel reads Amharic and other non-ASCII names
correctly) and guards against formula injection by prefixing cells starting with `=`, `+`,
`-`, or `@`. Excel export is HTML-flavoured `.xls` — a genuine styled worksheet, not binary
`.xlsx`. PDF opens a print-styled window and uses the browser's own PDF engine. If you later
need true binary `.xlsx` or server-side PDFs, swap in SheetJS / pdfkit; the call signatures
can stay the same.

---

## API reference

All routes require a valid JWT **and** the `Admin` role.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/stats?days=30` | Dashboard metrics + chart series |
| GET | `/api/admin/users` | Paged list (`search`, `role`, `status`, `verified`, `sortBy`, `sortDir`, `page`, `pageSize`) |
| POST | `/api/admin/users` | Create user |
| PATCH | `/api/admin/users/:id` | Update name / email / role / verified |
| PATCH | `/api/admin/users/:id/status` | Activate / deactivate |
| POST | `/api/admin/users/:id/reset-password` | Set password |
| DELETE | `/api/admin/users/:id` | Permanent delete |
| POST | `/api/admin/users/bulk` | Bulk activate / deactivate / delete |
| GET | `/api/admin/audit` | Paged audit log |
| GET | `/api/admin/export` | All users unpaged, for client-side export |

---

## Recommendations beyond the brief

Things I'd add next, roughly in order of value:

1. **Rate-limit the admin routes.** `express-rate-limit` is already a dependency and applied to
   `/api/auth`. Admin endpoints are unthrottled — a compromised admin token could enumerate or
   delete at speed.
2. **Make the audit log append-only at the database level.** Right now an admin with DB access
   could edit it. A `BEFORE UPDATE OR DELETE` trigger raising an exception on `audit_logs` would
   close that.
3. **Soft delete.** A `deletedAt` column with filtered queries would give you a recycle bin and
   make accidental deletion recoverable. Currently deletion is final.
4. **Two-person rule for admin creation.** For a system that issues verifiable credentials,
   requiring a second admin to approve a new admin is proportionate.
5. **CSV/Excel bulk import.** You'll want this the first time you onboard a whole class rather
   than five people.
6. **Configure SMTP.** Once real credentials are in, admin-created users can receive a
   "set your password" email instead of you relaying passwords manually.
7. **Session invalidation on deactivate.** A deactivated user's existing JWT stays valid until
   it expires (7 days by default). A token version column on User, checked in
   `authenticateToken`, would make deactivation immediate.
