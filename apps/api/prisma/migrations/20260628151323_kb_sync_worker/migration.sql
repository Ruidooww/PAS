-- AlterTable
ALTER TABLE "kb_documents" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "ragflow_updated_at" TIMESTAMP(3),
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "acl_scope" SET DEFAULT 'internal',
ALTER COLUMN "uploaded_by" DROP NOT NULL;

UPDATE "kb_documents" SET "synced_at" = "created_at";

-- CreateTable
CREATE TABLE "kb_sync_logs" (
    "id" TEXT NOT NULL,
    "ragflow_kb_id" TEXT NOT NULL,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_sync_logs_ragflow_kb_id_run_at_idx" ON "kb_sync_logs"("ragflow_kb_id", "run_at" DESC);
