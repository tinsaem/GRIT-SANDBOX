# GIVT Sandbox

**Gamified · Individualized · Verified Talent**
Seven-agent educational workforce platform — Kennesaw State University · Healthcare Informatics MVP · 2026.

Full-stack app: a React (Vite) frontend and an Express/Prisma/PostgreSQL API with
email+password and Google OAuth accounts, JWT sessions, and a token economy. It
implements the seven GIVT agents:

1. **Translator** — résumé ↔ desired job description capability-gap analysis + JD-language résumé translation.
2. **Talent** — employer profiling (company confirmation, AI + web-search profile, use cases, talent demand).
3. **Curriculum** — maps current courses to use cases, proposes future curriculum.
4. **Advisor** — three learning pathways, directed-study syllabi, professor supervision, token exchange ledger.
5. **Reputation** — on-résumé skill verification by stakeholders, scoring, leaderboard.
6. **Generator** — forward-looking curriculum modules + downloadable curriculum recommendation document (GAN loop seed).
7. **Discriminator** — compliance critique, standard curriculum guideline, Generator↔Discriminator equilibrium loop.

Plus a dashboard **account system** (Create Account, 500-token reward, Hedera address, upload/write profile, 250-word profile generation).

---

## Quick start (VS Code / local)

Requires **Node.js 18+** (Node 20 recommended) and a PostgreSQL database.

```bash
npm run setup                      # installs root (frontend) + server deps
cp server/.env.example server/.env # fill in DATABASE_URL, JWT_SECRET, etc.
npm run migrate                    # create the schema (Prisma migrate dev)
npm run db:seed                    # optional — demo accounts, see below
npm run dev:full                   # frontend (5173) + API (3000) together
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the Express
server on port 3000 (see `vite.config.js`).

Seeding creates one verified demo account per role (Student, Professor, Advisor,
Employer, Peer) plus sample company, verification, Rise, and Industry-pathway
records. Demo emails look like `student@givt.demo`; the password is `Passw0rd!`.
See `server/prisma/seed.js`. The seed is for development/demo databases only and
refuses to run when `NODE_ENV=production`.

### Build for production

```bash
npm run build            # bundles the frontend into dist/
npm run migrate:deploy   # apply migrations against the target database
npm start                # runs server/index.js, which serves the API AND dist/
                          # as a single process on $PORT (default 3000)
```

---

## Deploy on Replit

This repo is set up so **Replit Agent can import it straight from GitHub and deploy
it as one service** — see **[REPLIT_DEPLOY.md](REPLIT_DEPLOY.md)** for the required
secrets, database setup, and build/run commands it should use.

Short version: `.replit` already declares the build (`npm run setup && npm run
db:generate && npm run migrate:deploy && npm run build`) and run (`npm start`)
commands for an Autoscale deployment, plus a combined dev command (`npm run
dev:full`) for the workspace **Run** button. You still need to add the secrets
listed in REPLIT_DEPLOY.md (at minimum `DATABASE_URL` and `JWT_SECRET`) before it
will boot.

---

## Push to GitHub

```bash
git init
git add .
git commit -m "GIVT Sandbox initial commit"
git branch -M main
git remote add origin https://github.com/<you>/givt-sandbox.git
git push -u origin main
```

`node_modules/` and `dist/` are already in `.gitignore`.

---

## Project structure

```
givt-sandbox/
├── index.html               # Vite entry HTML
├── package.json             # root scripts + frontend deps (React 18 + Vite 5)
├── vite.config.js           # dev proxy (/api -> :3000) + preview config
├── .replit / replit.nix     # Replit dev + deployment config
├── REPLIT_DEPLOY.md         # secrets & steps for deploying via Replit Agent
├── context.md               # full spec to regenerate the UI in a new AI session
├── src/
│   ├── main.jsx              # React DOM root
│   ├── App.jsx               # router: HomePage / AuthPage / dashboard
│   ├── AuthContext.jsx       # JWT session state (localStorage-backed)
│   ├── api.js                # axios client for the Express API
│   ├── GIVTDashboard.jsx     # the seven agents + account dashboard
│   ├── pages/                # HomePage, AuthPage
│   └── components/           # ProtectedRoute, etc.
└── server/                   # Express API
    ├── index.js               # app entry — mounts routes, serves dist/ in prod
    ├── email.js                # nodemailer (verification / reset emails)
    ├── middleware/auth.js      # JWT auth + role-guard middleware
    ├── routes/                 # auth, users, tokens, verifications, companies,
    │                           # syllabi, leaderboard, gan
    └── prisma/
        ├── schema.prisma       # data model (Postgres)
        ├── seed.js             # demo accounts + sample company/verification
        └── migrations/         # schema history (`prisma migrate deploy` in prod)
```

The UI lives in **`src/GIVTDashboard.jsx`** (the seven agents + account system) plus
`src/pages/` for the marketing/auth screens. It uses React + hooks and inline styles —
no UI framework — and loads Google Fonts and the `mammoth` / `pdf.js` parsers from a
CDN at runtime.

---

## A note on AI features (live API calls)

Two features call the Anthropic Messages API directly from the browser:

- **Talent** → "Generate company profile" (uses web search)
- **Account** → "Update profile · generate 250-word profile"

In the Claude artifact environment these calls are proxied automatically. In a
standalone deployment (local / Replit / GitHub Pages) a direct browser call to
`api.anthropic.com` will fail (CORS + no key), and the app **gracefully falls back**
to built-in heuristic / template output — everything else works fully offline.

To enable live AI in production, add a small server-side proxy that injects your
`ANTHROPIC_API_KEY` and forward the request to `https://api.anthropic.com/v1/messages`,
then point the two `fetch(...)` calls in `src/GIVTDashboard.jsx` at your proxy URL.

---

## Regenerating this app from scratch

Open a new AI session and provide **`context.md`** (included here). It contains the
complete specification — design tokens, constants, every agent's behavior, scoring
formulas, the account system, and the GAN convergence targets — needed to rebuild the
exact same interface. For a byte-exact copy, just reuse `src/App.jsx`.
