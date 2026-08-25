-- =============================================================================
-- Link local profile rows to Keycloak identities.
--
-- users.keycloak_id is the durable join between "who Keycloak says this is"
-- and "what GIVT knows they have done" (wallet, verifications, syllabi).
--
-- password_hash becomes nullable: once a user is migrated, Keycloak holds their
-- credential and the local hash is nulled out. It stays on the table only for
-- users not yet migrated, which is what makes dual-mode possible.
-- =============================================================================

ALTER TABLE "users" ADD COLUMN "keycloak_id" TEXT;

CREATE UNIQUE INDEX "users_keycloak_id_key" ON "users"("keycloak_id");

-- Nullable so Keycloak-only users need no local password. Harmless if the
-- column is already nullable (Google OAuth users would have required this).
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
