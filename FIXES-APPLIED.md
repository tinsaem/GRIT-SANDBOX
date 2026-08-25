# Reviewer Fixes — What Changed

## Run it

From this folder (not `server/`):

```
npm run setup
npm run migrate
npm run db:seed
npm run dev:full
```

Open http://localhost:5173

| Login | Role |
|---|---|
| `admin@givt.demo` / `Passw0rd!` | Admin → `/admin` |
| `student@givt.demo` / `Passw0rd!` | Student |
| `peer@givt.demo` / `Passw0rd!` | Student (now a peer-capable student) |

---

## 1. Forgot password — FIXED

**Root cause:** `server/email.js` links to `/auth/reset/:token`, but `App.jsx`
never registered that route. The link fell through to the `*` catch-all and
silently redirected to `/`. The backend endpoint worked all along — there was
no screen.

**Fix:** new `src/pages/ResetPasswordPage.jsx` — new password + confirm
password, live match indicator, strength meter, show/hide toggle, auto sign-in
on success. Route added to `App.jsx`.

**Test:** sign-in screen → "Forgot password" → enter email → copy the reset URL
from the server console (SMTP is on placeholders, so no email sends) → paste in
browser → set a new password.

---

## 2. Peer is now a Student capability — FIXED

**Bug found beyond the modelling issue:** `verifications.js` looks up targets
with `role: "Student"`, so Peer-role accounts could never *receive*
verifications. Peers were invisible as students — exactly backwards.

**Changes:**
- `Peer` removed from the `Role` enum; migration converts existing Peer
  accounts to Student. No data loss — wallets, verifications, syllabi and
  messages all key off `users.id`.
- New `peerVerifierEnabled` flag on User, admin-toggleable, so the privilege
  can be revoked without changing someone's role.
- Removed from the signup picker — one registration, as Student.
- Students gained the `talent` agent so they can peer-review.
- Peer reviews still write `verifier_role = "Peer"`, preserving the 0.5
  scoring weight and keeping historical rows reproducible.
- Self-verification blocked on the capability path.
- New `GET /api/verifications/peer/quota` so the UI can show remaining
  capacity rather than failing at submit.

### ⚠ One constant needs the reviewer's confirmation

`server/routes/verifications.js` line 44:

```js
const PEER_MAX_STUDENTS = 1;
```

The reviewer wrote: *"each peer does not allow to give score for other many
peers it is only for one peer."* This implements the literal reading — each
student-as-peer may verify exactly **one** other student.

Two other readings are possible:
- one verification per student-pair (already guaranteed by the existing
  `@@unique([studentId, verifierId, skillName])` constraint);
- one *assigned* partner per review cycle, which needs an assignment table
  rather than a cap.

Change the number, or set it to `null` for unlimited. Nothing else needs
touching.

---

## 3. Keycloak — decision, not code

Yes, integration is possible, and the reviewer is right that it's the better
long-term choice. But the reason matters:

**The real argument is federation, not SSO convenience.** If AAU has an
LDAP/AD or SAML identity provider, Keycloak lets the *university* vouch that
someone is a student. Right now anyone with a Gmail address self-selects
"Employer" and issues verifications weighted at 1.0 — the deepest problem in
GIVT, and one that well-built password hashing does not touch.

**What moves out of your codebase:** roughly 460 lines of `auth.js` (signup,
login, OTP, reset, Google OAuth). `middleware/auth.js` gets rewritten to
validate against Keycloak's JWKS endpoint. `users` keeps existing but becomes
a *profile* row keyed to the Keycloak subject ID.

**What happens to the admin console:** its user-CRUD half becomes redundant
with Keycloak's own console. What survives is the GIVT-specific half — token
wallets, verification analytics, role-composition reporting, exports, audit
trail. Keycloak knows nothing about those. Plan for the rescope rather than
discover it mid-integration.

**Three questions to settle first:**
1. Does AAU have an LDAP/AD or SAML IdP to federate with? If not, Keycloak's
   main advantage over hardening what exists is smaller than it looks.
2. Who runs it in production — upgrades, backups, HA? It's a third service
   alongside the API and PostgreSQL.
3. How are **employers** verified? They have no institutional IdP. Separate
   problem Keycloak doesn't solve.

Also worth stating explicitly: Keycloak handles *authentication*, not
*identity assurance*. The `hederaAddress` field points at the layer that
would — anchoring credentials to a DID rather than a mutable database row.

---

## Verified

- Frontend builds clean: 97 modules, no errors
- All server `.js` files pass `node --check`
- Migration SQL: 9/9 statements parse as valid PostgreSQL
- Both enum-dependent columns (`users.role`, `messages.to_role`) handled

Not verified here: `prisma migrate` against a live database (sandbox blocks
Prisma's engine CDN), and the visual result of Students inheriting the
`talent` agent — worth a click-through.

---

## Note on the earlier P3006 error

The first migration only converted `users.role` and missed
`messages.to_role`, which also uses the `Role` enum — so `DROP TYPE` failed.
Corrected: both tables have `'Peer'` values cleared first, then both columns
move to the new enum, then the old type is dropped.

If `npx prisma migrate status` still reports it failed, clear the record from
`server/`:

```
npx prisma migrate resolve --rolled-back 20260729120000_peer_becomes_student_capability
```

---

## Leftover files

`server/routes/auth-Tinsae.js` and `src/pages/AuthPage-Tinsae.jsx` still
contain the old `Peer` role. Nothing imports them, so the build is unaffected —
but consider deleting or syncing them with Tinsae to avoid confusion.
