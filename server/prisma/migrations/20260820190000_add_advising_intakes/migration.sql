CREATE TABLE "advising_intakes" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "pathway" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "guidance" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advising_intakes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "advising_intakes_student_id_pathway_idx" ON "advising_intakes"("student_id", "pathway");
CREATE INDEX "advising_intakes_created_at_idx" ON "advising_intakes"("created_at");

ALTER TABLE "advising_intakes"
ADD CONSTRAINT "advising_intakes_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;