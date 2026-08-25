-- =============================================================================
-- Admin-configurable platform settings.
--
-- Replaces the hardcoded PEER_MAX_STUDENTS constant in verifications.js so an
-- administrator can change how many students a peer may evaluate (1, 2, 3, …)
-- without a code change or redeploy.
--
-- Deliberately a key/value table rather than a wide settings row: new settings
-- can be added without a migration, and reads are always by key.
-- =============================================================================

CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- Seed the peer limit at 1, matching the reviewer's "only for one peer".
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES (
  'peer_max_students',
  '1',
  'How many DISTINCT students one student may evaluate as a peer. Use 0 to disable peer review, or -1 for unlimited.'
);
