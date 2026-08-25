-- =============================================================================
-- Peer is no longer a separate role. It becomes a capability of Student.
--
-- Reviewer's point: "Student and Peer are the same person, one registration.
-- Peer is a role, a student with privileges to verify other students' skills
-- but not her/his own."
--
-- NOTE: the Role enum is used by TWO columns — users.role and messages.to_role.
-- Both must be migrated before the old type can be dropped, and both may hold
-- 'Peer' values that need converting first.
-- =============================================================================

-- 1. Capability flag. Every student can peer-verify by default; an admin can
--    revoke it without changing the person's role.
ALTER TABLE "users" ADD COLUMN "peer_verifier_enabled" BOOLEAN NOT NULL DEFAULT true;

-- 2. Convert existing Peer accounts into Students that keep the privilege.
--    No data is lost: wallets, verifications, syllabi and messages all key off
--    users.id, which does not change.
UPDATE "users"
   SET "role" = 'Student',
       "peer_verifier_enabled" = true
 WHERE "role" = 'Peer';

-- 3. Messages addressed to the Peer role are now addressed to Students.
--    This must happen before the type swap or the cast in step 6 will fail.
UPDATE "messages"
   SET "to_role" = 'Student'
 WHERE "to_role" = 'Peer';

-- 4. Historical verifications keep their "Peer" label. skill_verifications.
--    verifier_role is a TEXT column, not the enum, so past peer reviews stay
--    attributable and keep their 0.5 scoring weight. Nothing to migrate there.

-- 5. Drop 'Peer' from the Role enum. PostgreSQL cannot remove an enum value in
--    place, so: rename the old type, create the new one, move every dependent
--    column across, then drop the old type.
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('Student', 'Professor', 'Advisor', 'Employer', 'Admin');

-- 6. Move BOTH dependent columns. Steps 2 and 3 guarantee no row still holds
--    'Peer', so every cast succeeds.
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role"
  USING ("role"::text::"Role");

ALTER TABLE "messages"
  ALTER COLUMN "to_role" TYPE "Role"
  USING ("to_role"::text::"Role");

-- 7. Now nothing depends on the old type.
DROP TYPE "Role_old";

-- 8. Keeps the "how many students has this peer verified?" cap check cheap —
--    it runs on every peer verification attempt.
CREATE INDEX IF NOT EXISTS "skill_verifications_verifier_id_idx"
  ON "skill_verifications"("verifier_id");
