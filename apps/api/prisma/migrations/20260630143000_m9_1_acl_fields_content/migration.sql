ALTER TABLE "kb_documents"
  ADD COLUMN "sensitivity" TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN "chunk_sensitivity_map" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "field_acls" (
  "id" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "field_name" TEXT NOT NULL,
  "required_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "required_attrs" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_acls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acl_audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "field_name" TEXT,
  "chunk_id" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "acl_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "field_acls_resource_type_resource_id_idx"
  ON "field_acls"("resource_type", "resource_id");

CREATE INDEX "field_acls_resource_type_field_name_idx"
  ON "field_acls"("resource_type", "field_name");

CREATE INDEX "acl_audit_logs_user_id_idx"
  ON "acl_audit_logs"("user_id");

CREATE INDEX "acl_audit_logs_resource_type_resource_id_idx"
  ON "acl_audit_logs"("resource_type", "resource_id");

CREATE INDEX "acl_audit_logs_created_at_idx"
  ON "acl_audit_logs"("created_at");
