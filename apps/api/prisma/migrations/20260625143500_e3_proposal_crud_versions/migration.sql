ALTER TABLE "proposals"
ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_versions_proposal_id_version_key"
ON "proposal_versions"("proposal_id", "version");

CREATE INDEX "proposal_versions_proposal_id_created_at_idx"
ON "proposal_versions"("proposal_id", "created_at");

ALTER TABLE "proposal_versions"
ADD CONSTRAINT "proposal_versions_proposal_id_fkey"
FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
