-- Add the Admin value to the Role enum.
-- PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long as
-- the new value is not referenced in the same transaction, which is the case here.
ALTER TYPE "Role" ADD VALUE 'Admin';

-- Account status + login tracking on users
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deactivated_reason" TEXT;

CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- Audit trail for every administrative mutation
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "target_name" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
