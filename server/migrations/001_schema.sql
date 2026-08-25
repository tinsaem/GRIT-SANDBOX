-- GIVT Platform — PostgreSQL Schema
-- Database: givt-db  Port: 5432
-- Run via: node server/migrate.js

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                     VARCHAR(255) UNIQUE,
  google_id                 VARCHAR(255) UNIQUE,
  password_hash             VARCHAR(255),
  name                      VARCHAR(255) NOT NULL,
  role                      VARCHAR(50)  NOT NULL
                              CHECK (role IN ('Student','Professor','Advisor','Employer','Peer')),
  hedera_address            VARCHAR(100),
  profile_text              TEXT,
  email_verified            BOOLEAN      NOT NULL DEFAULT false,
  verification_token        VARCHAR(255),
  verification_token_expires TIMESTAMPTZ,
  reset_token               VARCHAR(255),
  reset_token_expires       TIMESTAMPTZ,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── TOKEN WALLETS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_wallets (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id)
);

-- ─── TOKEN LEDGER ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_ledger (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           VARCHAR(100) NOT NULL,
  amount         INTEGER      NOT NULL,
  from_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  to_user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  from_label     VARCHAR(100),
  to_label       VARCHAR(100),
  note           TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── SKILL VERIFICATIONS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_verifications (
  id            UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verifier_id   UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name    VARCHAR(255) NOT NULL,
  verifier_role VARCHAR(50)  NOT NULL,
  confidence    INTEGER      NOT NULL CHECK (confidence IN (1, 2)),
  comment       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, verifier_id, skill_name)
);

-- ─── RESUMES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  is_current BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── JOB DESCRIPTIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_descriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        TEXT        NOT NULL,
  target_company VARCHAR(255),
  is_current     BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COMPANIES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  profile    TEXT,
  sector     VARCHAR(100),
  created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  locked     BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COMPANY USE CASES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_use_cases (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  use_case_id  VARCHAR(10) NOT NULL,
  description  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SYLLABI ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syllabi (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        REFERENCES users(id) ON DELETE CASCADE,
  advisor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  professor_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  title        VARCHAR(255) NOT NULL,
  content      JSONB        NOT NULL DEFAULT '{}',
  status       VARCHAR(50)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','supervised','completed')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── SUPERVISION ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supervision (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  syllabus_id     UUID        NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  tokens_awarded  INTEGER     NOT NULL DEFAULT 900,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(professor_id, syllabus_id)
);

-- ─── GAN SESSIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gan_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector               VARCHAR(100) NOT NULL,
  loops_run            INTEGER      NOT NULL DEFAULT 0,
  mean_coverage        DECIMAL(5,2),
  modules              JSONB,
  equilibrium_reached  BOOLEAN      NOT NULL DEFAULT false,
  recommendation_text  TEXT,
  guideline_text       TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id        ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verif_student          ON skill_verifications(student_id);
CREATE INDEX IF NOT EXISTS idx_verif_verifier         ON skill_verifications(verifier_id);
CREATE INDEX IF NOT EXISTS idx_ledger_to_user         ON token_ledger(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_from_user       ON token_ledger(from_user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user           ON resumes(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_jd_user                ON job_descriptions(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_syllabi_student        ON syllabi(student_id);
CREATE INDEX IF NOT EXISTS idx_supervision_professor  ON supervision(professor_id);
CREATE INDEX IF NOT EXISTS idx_gan_user               ON gan_sessions(user_id);
