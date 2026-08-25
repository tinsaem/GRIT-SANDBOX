# Peer Evaluation + Admin-Configurable Limit

## ⚠ Why your Replit deploy showed no change

You pushed to the branch **`keycloak-and-reset-fix`**. Replit deploys from
**`main`**. Your `main` still has the old code, so the reset fix was never
deployed.

Fix:

```powershell
git checkout main
git merge keycloak-and-reset-fix
git push origin main
```

Then Replit: **Git → Pull**, then **Deploy → Redeploy**. Confirm
`CLIENT_URL=https://givtsn.replit.app` is in Secrets.

Your SMTP is already working — the reset email arrived, so that part is done.

---

## What's new in this build

### 1. Student peer evaluation — `/peer-review`

A student can now find and evaluate other students:

- **Search by name or email** — debounced, so typing doesn't hammer the API
- **Self is excluded** from the candidate list
- **Already-evaluated students are removed** from search results and shown in a
  separate "Already evaluated by you" section — a student can never score the
  same person twice
- **Quota badge** shows allowance used, e.g. "1 of 2"
- Scoring modal asks for skill, confidence (first-hand = full weight,
  second-hand = half weight), and an optional comment
- Clear warning that an evaluation cannot be undone

Reachable at `/peer-review`, gated to the Student role.

### 2. Admin-configurable peer limit

The hardcoded `PEER_MAX_STUDENTS = 1` is **gone**. The limit now lives in the
database and an admin changes it in **Admin console → Settings**:

| Value | Effect |
|---|---|
| `1` | Each student may evaluate exactly one other student (default) |
| `2`, `3`, `4`… | Up to that many different students |
| `0` | Peer review disabled platform-wide |
| `-1` | Unlimited |

Quick-set buttons for 1–5, plus Off and ∞. **Changes take effect on the next
request** — no redeploy. The cache is invalidated on write.

### 3. Peer participation overview

Also on the Settings tab: how many students have evaluated, how many haven't,
total peer reviews, and a per-student count. Shows which students have their
peer privilege disabled.

---

## Rules always enforced (not configurable)

These are enforced **server-side** — the UI only avoids offering actions that
would be rejected:

1. A student can never evaluate themselves
2. A student can never evaluate the same student twice
3. A student can never verify the same skill twice for anyone
   (existing `@@unique([studentId, verifierId, skillName])`)
4. A student whose `peerVerifierEnabled` is false cannot evaluate at all

---

## Files

### New
| Path | Purpose |
|---|---|
| `server/services/settings.js` | Cached runtime settings, 30 s TTL, invalidated on write |
| `server/prisma/migrations/20260802100000_platform_settings/` | `platform_settings` table, seeded at 1 |
| `src/pages/PeerReviewPanel.jsx` | Search + evaluate UI |
| `src/pages/PeerReviewPage.jsx` | Page shell at `/peer-review` |

### Modified
| Path | Change |
|---|---|
| `server/prisma/schema.prisma` | `PlatformSetting` model |
| `server/routes/verifications.js` | Reads limit from settings; new `GET /peer/candidates` |
| `server/routes/admin.js` | `GET/PATCH /settings`, `GET /peer-review-overview` |
| `src/api.js` | `peerAPI`; `adminAPI.settings/updateSetting/peerReviewOverview` |
| `src/pages/AdminDashboard.jsx` | Settings tab with limit control and participation panel |
| `src/App.jsx` | `/peer-review` route |

---

## Run

```
npm run setup
npm run migrate      # applies platform_settings
npm run db:seed
npm run dev:full
```

### Test the peer flow

1. Log in as `student@givt.demo` / `Passw0rd!`
2. Go to **http://localhost:5173/peer-review**
3. Search for "Riley" (the other seeded student) → **Evaluate**
4. Enter a skill, pick confidence, submit
5. Riley moves to "Already evaluated by you" and disappears from search
6. Quota badge reads "1 of 1" and the search box is replaced by a
   limit-reached message

### Test the admin control

1. Log in as `admin@givt.demo` / `Passw0rd!`
2. **Settings** tab → Peer evaluation limit → click **2** → **Save change**
3. Back as the student, reload `/peer-review` → you can now evaluate a second
   student, and the badge reads "1 of 2"
4. Set it to **Off** → the student sees "Peer review is currently disabled"

---

## New API endpoints

| Method | Endpoint | Who |
|---|---|---|
| GET | `/api/verifications/peer/candidates?search=` | Student |
| GET | `/api/verifications/peer/quota` | Student |
| GET | `/api/admin/settings` | Admin |
| PATCH | `/api/admin/settings/:key` | Admin |
| GET | `/api/admin/peer-review-overview` | Admin |

---

## Verified

- Frontend builds clean: **100 modules**
- All server `.js` files pass `node --check`
- Migration SQL parses as valid PostgreSQL

Not verified: the browser click-through, and Keycloak's OIDC handshake (no
Docker in my environment).

---

## One design note

The peer page is a **separate route** rather than a tab inside
`GIVTDashboard.jsx`. That file is ~1300 lines and restructuring its agent
switcher carried real risk of breaking the existing student experience. If you
would rather have it as a dashboard tab, that is a contained follow-up — say so
and I will wire it in.
