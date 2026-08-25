# GIVT Sandbox — Build Context & Specification

> Provide this file at the start of a new session to regenerate the **exact same**
> GIVT Sandbox interface. It is the authoritative specification. The deliverable is a
> **single-file React component** with a default export `App`, using only React + hooks
> and inline styles (no Tailwind, no UI library). For a byte-exact copy, reuse the
> companion `src/App.jsx`; this document lets an AI rebuild it from the spec alone.

---

## 0. Identity

- **Product:** GIVT Sandbox — **G**amified, **I**ndividualized, **V**erified **T**alent.
- **Owner / context:** Kennesaw State University · Healthcare Informatics MVP · 2026. Contact: Solomon Negash (snegash@kennesaw.edu).
- **Test storyline company:** Emory Healthcare.
- **Problem framing (homepage stats):** 58% of grads don't land their first job for 6+ months; >50% of hiring managers say grads lack required capabilities; $60B+ TAM across AI-in-education, LMS/LXP, skills intelligence & AI-HR.
- **Build mode:** live, in-memory session state (resets on refresh). No `localStorage`/`window.storage` in the artifact build; a production build would add persistence.
- **Tech:** React 18 functional component, hooks (`useState/useEffect/useMemo/useRef/useCallback`), inline styles. Babel/JSX. Default export `App`.

---

## 1. Design system (editorial / academic-modern — NOT AI-purple-gradient)

Color tokens object `C`:

```
ink #0E1116 · inkSoft #2A2F3A · paper #F7F3EC · paperWarm #EFE7D6 · rule #D8CFBE
gold #B8862F · goldDeep #8C6420 · teal #2D6E6A · tealDeep #1F4A47 · rust #A04A1E
green #1F7A3A · greenSoft #D4EAD8
```

Stakeholder role colors `ROLE_META` (color / soft / weight):

```
Employer  #B8862F / #F3E8CC / 1.0
Professor #2D6E6A / #D2E7E5 / 0.8
Advisor   #A04A1E / #F1DACB / 0.7
Peer      #1F7A3A / #D4EAD8 / 0.6
```

**Fonts** (Google Fonts, injected once via a `<link>` in a `useEffect`):
Fraunces (serif headings), DM Sans (sans body), JetBrains Mono (mono labels/figures).

**Animations** (injected once as a `<style>` with id `givt-anim` in the same effect):
```
@keyframes givtspin{to{transform:rotate(360deg)}}
@keyframes givtpulse{0%,80%,100%{opacity:.25}40%{opacity:1}}
```

**Layout:** sticky dark masthead (ink bg, gold bottom border) with title + tagline +
Create Account button. Below: a two-column grid `230px 1fr`, max-width 1180. Left = sticky
nav rail (4 foreground agents under "Foreground · Talent group", 3 under "On-chain · GAN
loop") + a WALLETS box. Right = `<HomeBanner>` (dashboard) then the active agent. Footer note.

**Formatting discipline:** minimal; inline styles only; Fraunces for big numbers/titles,
JetBrains Mono for tags/figures/eyebrows, DM Sans for prose.

---

## 2. Constants

```
EFFORT_RATIO = 3                 MAX_TRAINING_HRS = 15        MAX_WEEK_HRS = 9
DEFAULT_GAP_HRS = 12             STUDENT_TOKENS_PER_SKILL = 100
VERIFIER_POINTS_PER_SKILL = 500  VERIFIER_START_WALLET = 5000
PROFESSOR_TOKENS_PER_SYLLABUS = 900   ACCOUNT_REWARD = 500
creditHours(trainingHrs) = ceil(trainingHrs / 5)
```

**SECTORS (12):** Healthcare & HealthTech; FinTech & Decentralized Finance; Banking &
Financial Services; Transportation & Smart Mobility; Media & Entertainment; Sports &
SportsTech; STEM & Advanced Technology; Sustainability & CleanTech; Manufacturing;
E-commerce & Digital Economy; EdTech & Digital Education; Other.

**INNOVATION_SOURCES** (Generator grounding, real URLs): HIMSS "Future of AI in
Healthcare"; HIMSS "AI in Healthcare Forum 2025"; JMIR 2025 "Incorporating Generative AI
Into a Health Informatics Curriculum"; JMIR 2020 "Teaching Hands-On Informatics Skills"; HIMSS CPHIMS courses.

**COMPLIANCE_SOURCES** (Discriminator training, real URLs) with `lens` keys: HHS HIPAA
(`hipaa`); ASTP/ONC Information Blocking (`onc`); HL7 FHIR R4 (`fhir`); NIST AI RMF
(`nist`); EU AI Act (`euai`); AHA RFI response Feb 2026 (`monitoring`).

**COMPLIANCE_LENSES:** hipaa→"HIPAA PHI safeguards"; onc→"ONC interoperability /
info-blocking"; fhir→"HL7 FHIR R4 conformance"; nist→"NIST AI RMF lifecycle controls";
euai→"EU AI Act risk tiering"; monitoring→"Continuous monitoring / drift".

**LEADERBOARD_FIXTURE:** Maya Osei 91, Jordan Liu 87, Aisha Patel 83, Devon Marsh 78, Riley Tanaka 74.
**LEVELS:** L1 Major, L2 Department, L3 College, L4 University, L5 Regional, L6 National.

**SKILL_DICT (~33 entries)** — `{name, aliases[]}` for word-boundary detection. Includes:
Python, R, SQL, Java, JavaScript, Machine Learning, Deep Learning, Data Analysis, Data
Visualization (aliases incl. "dashboards"), Statistics, HL7, FHIR, HIPAA, EHR/EMR, Epic,
Cerner, Clinical Informatics, Health Information Management, Project Management,
Agile/Scrum, Cloud, ETL, Data Governance, Cybersecurity, NLP, Excel, Power BI, Tableau,
Communication, Leadership, Interoperability, Regulatory Compliance, Databases, Version Control.

---

## 3. Shared app state (object `S` passed to every agent)

`globalResume/setGlobalResume`, `globalJD/setGlobalJD`, `resumeFiles/jdFiles (+setters)`,
`translatorOut`, `detectedCompany` (JD target), `resumeCompany` (from résumé), `talent`,
`curriculum`, `reputation {verifs}`, `studentTokens` (start 0), `professorTokens` (start
VERIFIER_START_WALLET), `ganSeed`, `ganRecommendation`, `userMetrics`, `verifierLedger`
(per role `{points, wallet}`), `supervision[]`, `tokenLedger[]` + `pushLedger`,
`account/setAccount`, `showAccount/setShowAccount`, `creditRole(role, amount)`,
`addVerifierPoints`, `pushSupervision`.

`creditRole`: Student→studentTokens; Professor→professorTokens; Employer/Advisor/Peer→`verifierLedger[role].wallet`.

---

## 4. Shared helpers / algorithms

- `sanitize(raw)` — normalize quotes/bullets/dashes, strip control chars.
- `looksBinary(raw)` — detect pasted .docx/.pdf bytes (PK / %PDF / replacement chars).
- `detectSkills(text)` — word-boundary alias match against SKILL_DICT → skill names.
- `capabilityGap(resume, jd)` → `{resumeSkills, jdSkills, gaps (jd−resume), met}`.
- `extractCompany(text, {preferFirst})` — regex over capitalized phrases ending in org
  endings (Health System, Healthcare, Hospital, Medical Center, University, Clinic, Institute,
  Group, Network, etc.). JD: longest unique hit. Résumé (`preferFirst:true`): first hit.
- **JD-language translation:** `translateResume(resume, jd)` → `{text, examples[], role}`.
  Detects JD role title (`extractJdTitle`), JD action verbs, and the JD's own phrasing per
  skill (`jdPhraseFor`). Each résumé line containing a JD-shared skill is rewritten as
  `"<Verb> solutions applying <jdTerm> for the <role> role — <original line>"`, marked `▸`;
  unchanged lines marked `·`. `examples` = up to 4 before→after pairs.
- **Résumé highlighting:** `highlightResume(resume)` → array of `{type:'text'|'skill', value, skill}`
  segments; non-overlapping skill spans (longest-at-position wins) for clickable verification.
- `buildStandardGuideline(sector)` — Discriminator: text doc from COMPLIANCE_SOURCES (per
  lens: authority, URL, required outcome, assessment) + equilibrium criterion.
- `buildCurriculumDocument(sector, modules)` — Generator: full recommendation doc (exec
  summary w/ mean coverage, grounding sources, per-module priority/topics/compliance/
  recommendation via `MODULE_GUIDE`, overall recommendations).
- `seedModules(sector)` → 6 modules with coverages **[66,58,54,62,56,64]** (mean 60) and
  lens flags. Names: Foundations of Health AI & Data Stewardship; Generative AI for Clinical
  Documentation; Interoperability & FHIR-Native Integration; Predictive Analytics & Model
  Validation; AI Governance, Risk & Compliance; Responsible Deployment & Monitoring.
- **GAN loop:** `runGanLoop(prevModules, loopNumber, sector)` → `{step1, critique, step3,
  meanCoverage, flagsCount, equilibriumReady, loopNumber}`. Deterministic flags: loop 1 → 5
  flags, loop ≥2 → 0. Revision = **uniform lift** to `targetMean = 60 + loopNumber*4`, so mean
  coverage converges exactly **64% → 68% → 72%** (flags 5 → 0 → 0; equilibrium-ready at loop 2).
- `downloadText(filename, text)`, `wordCount(t)`.
- **FileUploader** — tabs Paste/Write · Browse Files · Drag & Drop. Parses `.docx` via
  `mammoth`, text-based `.pdf` via `pdf.js` (both lazy-loaded from cdnjs), plain text direct.
  Removable green file chips (name / words / KB). Optional URL add (`allowUrl`).
- **UI atoms:** `Btn` (kinds: solid, gold, teal, ghost, green, rust), `Spinner` (⏳ + spinning
  ring + 3 pulsing dots), `Tag`, `Bar`, `Panel` (eyebrow + title + accent top rule), `Field`,
  `ScoreCard`, `GanBanner`.

---

## 5. Dashboard (HomeBanner) + Account system

**Dashboard banner (top of HomeBanner):**
- If no account: prominent dark CTA banner "Create your GIVT account" + subtext "Students,
  advisors, professors, employers, and peers each earn **500 tokens** for joining" + gold
  button "✦ Create Account · +500 GIVT" (opens modal).
- If signed in: identity card with role badge (role color), name, Hedera address, and an
  "Update profile" button (opens modal).
- A second "✦ Create Account" / signed-in button also sits in the masthead.

**Six stat cards** (grid of 3): static 58% / >50% / $60B+ (gold top rule); LIVE Reputation
Score % / Verification Scope % / Tokens earned (teal top rule, "● LIVE" tag).

**WALLETS box (nav rail):** Student tokens, Professor tokens, and — if signed in as
Employer/Advisor/Peer — that role's wallet; plus "Signed in: name (role)".

**AccountModal** (overlay):
- Fields: **Participant role** (Student/Advisor/Professor/Employer/Peer), **Full name**,
  **Hedera account address** (0.0.XXXXXXX).
- **Profile — upload or write:** a FileUploader for source (upload bio/résumé or write).
- **"Update profile · generate 250-word profile"** button:
  - source > 250 words → **summarize** to ~250 (Anthropic API).
  - source 1–250 words → **enhance** to ~250 using **web search** (Anthropic API + web_search tool).
  - empty → **generate from scratch** using web search.
  - Shows a `Spinner` + animated skeleton while generating; result lands in an editable
    "Generated 250-word profile — edit, then confirm" textarea (live word count). Offline
    fallback = `fallback250(...)` (summarize truncates to 250; enhance/create returns a
    polished template). Iterative: regenerate works on the edited draft.
- **Create account · +500 GIVT** (or Save changes). On new account: `creditRole(role, 500)`
  and a `tokenLedger` entry `{kind:"account", amount:500, from:"GIVT treasury", to:role}`.

---

## 6. The seven agents

### Agent 01 — Translator (foreground, accent ink)
Inputs: two FileUploaders → `globalResume`, `globalJD` (shared app-level, reused everywhere).
Run: guard against binary paste / missing inputs; compute `capabilityGap`; set
`detectedCompany = extractCompany(jd)` and `resumeCompany = extractCompany(resume,{preferFirst})`;
`translateResume`. Outputs:
- **Output 1 · Capability-gap analysis:** detected company; counts; gap tags (rust) and
  already-met tags (green).
- **Output 2 · Translated résumé:** résumé rewritten in JD vocabulary (role noted; `▸` = rewritten).
- **Output 3 · Before → After examples:** per-skill, original line struck-through → JD-language rewrite.

### Agent 02 — Talent (background, accent gold)
- GanBanner (view/download GAN recommendation when present).
- Read-only JD (from Translator). **Company-name confirmation** pre-filled from
  **`resumeCompany`** (the company named in the submitted résumé), editable; chips to fill
  "from résumé: X" and "target in JD: Y"; Confirm / Change / Rebuild.
- Profile generation via **Anthropic API + web_search** (`claude-sonnet-4-20250514`),
  heuristic fallback; shows `Spinner` + animated skeleton while generating; editable;
  lockable as final.
- Open JDs uploader (URL + multi-file + paste).
- **Output 1 · Use cases** (UC01…, numbered). **Output 2 · Forward-looking talent demand**
  (rising/emerging tags).

### Agent 03 — Curriculum (foreground, accent teal)
- Parses a course catalog of `DEPT NNNN — Title` lines (sample catalog provided).
- **Enhanced courses** tagged with the use-case numbers (UC#) they satisfy.
- **Future curriculum** proposals (NEW / MODIFY).

### Agent 04 — Advisor (foreground, accent rust)
Three pathways from gaps + JD + curriculum:
- **Pathway 1:** university courses (schedule-aware, UC tags).
- **Pathway 2:** professional training catalog (provider / offering / training hrs).
- **Pathway 3:** directed-study **syllabi** (≤15 training hrs each), each with 6 sections
  (credit hours, JD-flavored objectives, outcomes, gaps addressed, weekly schedule ≤9
  hrs/wk, task list) + assessment. Per syllabus: Download · Email · Share with professor ·
  **"Professor: agree to supervise (+900)"** → credits professor +900 and logs a ledger
  entry; badge shows "✓ Supervising · +900 GIVT credited to professor".
- **Wallet box:** professor & student balances; **professor → student award** of a portion
  of earned tokens via `AwardBox` (10/25/50/100% quick buttons + number input); and a
  **Token Exchange Ledger** listing every transfer (escrow→professor, professor→student).

### Agent 05 — Reputation (on-chain, accent green)
- Top: **"🏆 Leaderboard Display"** button (opens a centered modal overlay leaderboard, with
  L1–L6 level selector, your live row highlighted) — replaces any inline leaderboard list.
- Acting role select (4 stakeholders), confidence (1 first-hand / 2 aware), Hedera (optional),
  100-word comment.
- **Student résumé with highlighted skills:** render `highlightResume(globalResume)`; every
  detected skill is a clickable span. Clicking verifies that skill **as the acting role** —
  the span turns **green** with a ✓; student +100 tokens, verifier +500 points. One
  verification per role per skill. Verifications keyed by skill name.
- **Verified skills & stakeholder badges:** per verified skill, a green chip + role-colored
  badges (Employer gold / Professor teal / Advisor rust / Peer green) with C1/C2; plus a
  stakeholder color legend.
- **Scoring** (ScoreCards): Reputation = round(weightedTokens / 1550 × 100), capped 100,
  where weightedTokens = Σ roleWeight × (conf 1→1.0, conf 2→0.5) × 100. Verification status
  = round(mean(roleWeight × confWeight) × 100). Composite = round(√(Reputation × VStatus)).
  Live metrics feed the dashboard.

### Agent 06 — Generator (background GAN loop, accent teal)
- Sector select (+ "Other" free text). **"Generate forward-looking curriculum ▶"** →
  `seedModules`, sets `ganSeed`.
- **Real innovation sources** panel (links).
- **Seed output:** module list with coverage bars; "✓ Seed passed to the Discriminator."
- **Document panel — "Forward-looking curriculum — recommendations":** **View** (toggle inline
  `<pre>`) and **Download** (`givt-forward-looking-curriculum.txt`) of
  `buildCurriculumDocument(sector, modules)` — exec summary, grounding sources, per-module
  recommendations (priority/topics/compliance/recommendation), overall recommendations.

### Agent 07 — Discriminator (background GAN loop, accent rust)
- Sector (auto-suggested from detected company). Buttons: **"Generator and Discriminator
  Loop ▶"** (→ "Next Loop ▶") runs `runGanLoop`; **"Equilibrium Reached ✓"** (enabled when
  last loop is equilibrium-ready) publishes `ganRecommendation` to Talent/Curriculum/Advisor.
- **Real compliance sources** panel (links + lens labels).
- **Standard curriculum guideline** panel: **View** / **Download**
  (`givt-standard-curriculum-guideline.txt`) of `buildStandardGuideline(sector)`.
- **Per loop:** STEP 1 Generator recommendation (coverages), STEP 2 Discriminator critique
  (flags w/ source), STEP 3 Generator revision (mean coverage) + view/download revised
  recommendation. Equilibrium-ready note. Converges 64→68→72% (flags 5→0→0).

---

## 7. Behavior to preserve exactly

- Convergence numbers: coverage **64 / 68 / 72**, flags **5 / 0 / 0**, equilibrium at loop 2.
- Token economics: student +100/verified skill; verifier +500/skill; professor +900/
  supervised syllabus; account creation +500; professor→student award is a portion of the
  professor wallet; everything logged in the token exchange ledger.
- Company population: Talent's company field pre-fills from the **résumé** company; JD target
  available as a chip.
- Reputation verification happens **on the résumé via highlighted skills**, not a separate
  skills list; verified = green + role-colored badge; leaderboard is a **button → modal**.
- AI calls use model `claude-sonnet-4-20250514` (+ `web_search_20250305` tool where noted)
  with graceful offline fallbacks.
- Single file, default export `App`, inline styles, no localStorage.

---

## 8. Suggested regeneration prompt

> "Build the GIVT Sandbox exactly as specified in the attached context.md: a single-file
> React component (default export `App`, inline styles, React hooks only) implementing all
> seven agents, the dashboard account system, the design tokens/constants, the scoring and
> token economics, and the GAN loop that converges to 64/68/72% coverage. Match every section
> in §5 and §6 and preserve the behaviors in §7."
