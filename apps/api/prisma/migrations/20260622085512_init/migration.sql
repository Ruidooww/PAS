-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'sales', 'presales', 'delivery');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('external', 'pas');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('draft', 'final');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "dept_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_mirrors" (
    "ref" TEXT NOT NULL,
    "source" "CustomerSource" NOT NULL DEFAULT 'external',
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "scale" INTEGER,
    "owner_id" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_mirrors_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "customer_ref" TEXT NOT NULL,
    "opportunity_ref" TEXT,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'draft',
    "requirement_json" JSONB NOT NULL,
    "content_json" JSONB NOT NULL,
    "ppt_file_key" TEXT,
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_documents" (
    "id" TEXT NOT NULL,
    "ragflow_doc_id" TEXT NOT NULL,
    "ragflow_kb_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "product" TEXT,
    "acl_scope" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "detail_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_dept_id_idx" ON "users"("dept_id");

-- CreateIndex
CREATE INDEX "customer_mirrors_owner_id_idx" ON "customer_mirrors"("owner_id");

-- CreateIndex
CREATE INDEX "proposals_customer_ref_idx" ON "proposals"("customer_ref");

-- CreateIndex
CREATE INDEX "proposals_opportunity_ref_idx" ON "proposals"("opportunity_ref");

-- CreateIndex
CREATE INDEX "proposals_created_by_idx" ON "proposals"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "kb_documents_ragflow_doc_id_key" ON "kb_documents"("ragflow_doc_id");

-- CreateIndex
CREATE INDEX "kb_documents_ragflow_kb_id_idx" ON "kb_documents"("ragflow_kb_id");

-- CreateIndex
CREATE INDEX "kb_documents_acl_scope_idx" ON "kb_documents"("acl_scope");

-- CreateIndex
CREATE INDEX "kb_documents_uploaded_by_idx" ON "kb_documents"("uploaded_by");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "conversation_feedback_user_id_idx" ON "conversation_feedback"("user_id");

-- CreateIndex
CREATE INDEX "conversation_feedback_session_id_idx" ON "conversation_feedback"("session_id");

-- CreateIndex
CREATE INDEX "conversation_feedback_created_at_idx" ON "conversation_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_ref_fkey" FOREIGN KEY ("customer_ref") REFERENCES "customer_mirrors"("ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_feedback" ADD CONSTRAINT "conversation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
