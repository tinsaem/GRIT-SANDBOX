# GIVT — Run Locally & Deploy to Replit

Two things are done in this build:

1. **Password reset is fixed properly** — no longer possible to bypass.
2. **Keycloak is fully integrated in code** — one environment variable switches it on.

---

# ⚠ Read this first: Keycloak cannot run *on* Replit

This is a hard platform limit, not a configuration problem.

Your `.replit` uses `deploymentTarget = "autoscale"`, which runs **one Node
process**. Keycloak is a Java server that needs ~1 GB RAM, its own PostgreSQL
database, and a persistent long-running process. Replit Autoscale cannot host
it, and `docker compose` is not available in Replit deployments.

**So the architecture is:**

```
Replit (your GIVT app)  ──HTTPS──>  Keycloak (hosted elsewhere)
                                          │
                                          └── its own PostgreSQL
```

Everything in this package is configured and ready. The only thing you must
provide is a Keycloak URL. Three ways to get one — pick one:

| Option | Cost | Setup time | Notes |
|---|---|---|---|
| **Local Docker** (included) | Free | 5 min | Works immediately for local dev. Not reachable from a deployed Replit app. |
| **Railway / Render / Fly.io** | ~$5–10/mo | 30 min | Supports Docker. Best fit for a working demo. |
| **Cloud-IAM / managed Keycloak** | Free tier available | 15 min | Least operational work. |
| **University VPS** | — | Varies | Best long-term, and the right home if you federate to AAU. |

**Until you have a Keycloak URL, leave `AUTH_MODE=local`.** The app runs exactly
as it does today. Nothing is broken by the Keycloak code being present.

---

# Part 1 — Run locally (no Keycloak)

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
| `peer@givt.demo` / `Passw0rd!` | Student (peer-capable) |

## Test the password reset fix

1. Sign-in screen → **Forgot password** → enter `student@givt.demo`
2. SMTP is on placeholders, so **copy the reset URL from the backend console**
   (the magenta output). It looks like
   `http://localhost:5173/auth/reset/<long-token>`
3. Paste it in the browser. You now get a form demanding **new password +
   confirm**, with a strength meter and live match check.
4. Submit → you are sent to the **sign-in page**, not the dashboard.
5. Log in with the new password.

**Try to break it:** log in first, then open the reset link in the same
browser. It still shows the form — the page destroys any existing session on
mount. That was the bug.

### What changed and why

| Defence | Where | Stops |
|---|---|---|
| Session cleared on page mount | `ResetPasswordPage.jsx` | A live session bouncing you to the dashboard, which looked like "logged in without resetting" |
| Token validated before the form renders | `GET /api/auth/reset-password/:token/validate` | Expired links silently redirecting instead of explaining |
| **No JWT returned from `/reset-password`** | `server/routes/auth.js` | Auto sign-in masking whether the password actually changed |
| Redirect to login, not dashboard | `ResetPasswordPage.jsx` | Any doubt that the new password works |

The previous version returned a token from `/reset-password` and signed the
user straight in. Combined with a stale `localStorage` session and the fact
that the deployed build had no `/auth/reset/:token` route at all, that produced
exactly what you described.

---

# Part 2 — Run locally *with* Keycloak

Requires Docker Desktop with the WSL2 backend.

## 2.1 Start Keycloak

```
docker compose -f docker-compose.keycloak.yml up -d
docker compose -f docker-compose.keycloak.yml logs -f keycloak
```

Wait for `Keycloak 26.x on JVM ... started`. Then open
**http://localhost:8080/admin** — user `admin`, password `admin`.

Switch the realm selector (top-left) from `master` to **givt**. Roles, both
clients, and two test users are already there — imported from
`keycloak/givt-realm.json`.

Ports: Keycloak **8080**, Keycloak's own database **5433**. Your `givt-db` on
5432 is untouched.

## 2.2 Add the database column

```
npm run migrate
```

Applies `20260801100000_add_keycloak_id`.

## 2.3 Switch it on

Add to **`server/.env`**:

```
AUTH_MODE=dual
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=givt
KEYCLOAK_AUDIENCE=givt-api
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

Add to the **project-root `.env`** (create it if absent — Vite only reads
`VITE_*`):

```
VITE_AUTH_MODE=dual
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=givt
VITE_KEYCLOAK_CLIENT_ID=givt-frontend
```

Restart: `npm run dev:full`

## 2.4 What you get

The sign-in screen now shows **"Sign in with institutional account"** above the
email form. Both paths work simultaneously — that is what `dual` means.

- `AUTH_MODE=local` — Keycloak ignored entirely (default, safe)
- `AUTH_MODE=dual` — both accepted. Use this while migrating.
- `AUTH_MODE=keycloak` — Keycloak only. Email form and Google button hidden.

## 2.5 Migrate existing users

⚠ **bcrypt hashes cannot be imported into Keycloak.** Every user must reset
their password. Tell them before you run this.

```
cd server
node scripts/migrate-users-to-keycloak.js --dry-run
node scripts/migrate-users-to-keycloak.js
```

Temporary passwords are written to `server/keycloak-temp-passwords-<ts>.json`.
Distribute securely, **then delete the file**. It is already git-ignored.

`server/services/userSync.js` matches on email, so migrated users keep their
existing `id`, wallet, verifications and syllabi. Nothing is lost.

## 2.6 Full cutover

Set `AUTH_MODE=keycloak` and `VITE_AUTH_MODE=keycloak`. The local email form
disappears. Optionally then delete `/signup`, `/login`, `/verify-otp`,
`/forgot-password`, `/reset-password` from `server/routes/auth.js`.

---

# Part 3 — Deploy to Replit

## 3.1 Push

```
git add .
git commit -m "Fix password reset; integrate Keycloak IAM"
git push origin main
```

Then in Replit: **Git** pane → **Pull**.

## 3.2 Secrets (Tools → Secrets)

**Required, Keycloak or not:**

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon/Replit PostgreSQL URL |
| `JWT_SECRET` | Long random string — generate a new one, do not reuse the local value |
| `CLIENT_URL` | `https://your-app.replit.app` ← **the reset email builds its link from this** |
| `SERVER_URL` | `https://your-app.replit.app` |
| `NODE_ENV` | `production` |
| `AUTH_MODE` | `local` for now |

**For working reset emails** (currently placeholders, so no email sends):

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | a Gmail **App Password** (16 chars, not your account password) |
| `EMAIL_FROM` | `GIVT Platform <your@gmail.com>` |

Gmail App Password: Google Account → Security → 2-Step Verification → App
passwords. Regular passwords are rejected by Gmail SMTP.

**Once you have a hosted Keycloak, add:**

| Key | Value |
|---|---|
| `AUTH_MODE` | `dual`, then `keycloak` |
| `KEYCLOAK_URL` | `https://your-keycloak.example.com` |
| `KEYCLOAK_REALM` | `givt` |
| `KEYCLOAK_AUDIENCE` | `givt-api` |
| `VITE_AUTH_MODE` | `dual` |
| `VITE_KEYCLOAK_URL` | same as `KEYCLOAK_URL` |
| `VITE_KEYCLOAK_REALM` | `givt` |
| `VITE_KEYCLOAK_CLIENT_ID` | `givt-frontend` |

`VITE_*` values are baked in at **build** time, so set them **before** you
redeploy, not after.

## 3.3 Redeploy

**Deploy** → **Redeploy**. Your `.replit` build already runs:

```
npm run setup && npm run db:generate && npm run migrate:deploy && npm run build
```

`migrate:deploy` applies the new migrations automatically.

## 3.4 Verify

1. `https://your-app.replit.app` loads
2. Log in with a seeded account
3. **Forgot password** → check the email arrives (needs SMTP secrets)
4. Click the link → confirm you get the **new password + confirm** form
5. Confirm you land on the **sign-in** page afterwards, not the dashboard

**If the reset link 404s on Replit:** `CLIENT_URL` is wrong or the deploy
predates this build. The link must be
`https://your-app.replit.app/auth/reset/<token>`.

## 3.5 Hosting Keycloak for the deployed app — Railway example

1. railway.app → New Project → Deploy from Docker image
2. Image: `quay.io/keycloak/keycloak:26.0`
3. Add a PostgreSQL service; Railway injects its connection variables
4. Set: `KC_DB=postgres`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD`,
   `KC_BOOTSTRAP_ADMIN_USERNAME`, `KC_BOOTSTRAP_ADMIN_PASSWORD`,
   `KC_HOSTNAME=<your-railway-domain>`, `KC_PROXY_HEADERS=xforwarded`,
   `KC_HTTP_ENABLED=true`
5. Start command: `start --optimized`
6. Once up: admin console → Realm → Create → **Import** `keycloak/givt-realm.json`
7. Clients → `givt-frontend` → set **Valid redirect URIs** and **Web origins**
   to `https://your-app.replit.app/*` and `https://your-app.replit.app`
8. Add `KEYCLOAK_URL` and the `VITE_*` secrets in Replit, then redeploy

⚠ Change the `givt-api` client secret in `keycloak/givt-realm.json` before any
non-local use, and set a real admin password.

---

# Files added or changed

## Password reset
| File | Change |
|---|---|
| `src/pages/ResetPasswordPage.jsx` | Rewritten — session clear, token pre-validation, confirm field, no auto-login |
| `server/routes/auth.js` | `/reset-password` no longer returns a JWT; added `/reset-password/:token/validate` |
| `src/api.js` | Added `validateResetToken` |
| `src/pages/AuthPage.jsx` | Success banner after reset |
| `src/App.jsx` | `/auth/reset/:token` route |

## Keycloak
| File | Purpose |
|---|---|
| `server/middleware/keycloakAuth.js` | Dual-mode auth. Same exports as `auth.js`, so no handler changed |
| `server/services/userSync.js` | Maps Keycloak identity → local profile, preserving wallets |
| `server/scripts/migrate-users-to-keycloak.js` | Bulk user migration with `--dry-run` |
| `src/keycloak.js` | Browser client, PKCE, silent SSO, token refresh |
| `public/silent-check-sso.html` | Required by keycloak-js |
| `keycloak/givt-realm.json` | Realm, roles, both clients, audience mapper |
| `docker-compose.keycloak.yml` | Local Keycloak + its database |
| `server/prisma/migrations/20260801100000_add_keycloak_id/` | `keycloak_id` column |

All 10 route files now import `middleware/keycloakAuth` instead of
`middleware/auth`. The old file is left in place so `AUTH_MODE=local` still
works and rollback is trivial.

---

# Verified

- Frontend builds clean: **99 modules**, no errors
- All server `.js` files pass `node --check`
- All 7 migrations parse as valid PostgreSQL (72 statements)
- `keycloak-js@^26.2.4` and `jwks-rsa@^4.1.0` installed

**Not verified — no Keycloak or Docker in my environment:** the OIDC handshake
itself. Expect to debug two things when you first connect:

1. **`jwt audience invalid`** → the audience mapper is missing. Clients →
   `givt-frontend` → Client scopes → dedicated → Add mapper → Audience →
   included client audience `givt-api`.
2. **CORS on the token endpoint** → add your origin under Clients →
   `givt-frontend` → Web origins.

Also unverified: the visual result of Students inheriting the `talent` agent
from the Peer merge. Worth a click-through.

---

# Rollback

`AUTH_MODE=local` + `VITE_AUTH_MODE=local`, restart. `middleware/auth.js` is
untouched and still present.
