-- CreateEnum
CREATE TYPE "IdpProvider" AS ENUM ('feishu', 'wecom', 'mock');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Seed default tenant for existing E0 data and local mock auth.
INSERT INTO "tenants" ("id", "name")
VALUES ('tenant-default', 'PAS Default Tenant')
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "users" ADD COLUMN "idp_provider" "IdpProvider" NOT NULL DEFAULT 'mock';
ALTER TABLE "users" ADD COLUMN "idp_user_id" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

UPDATE "users"
SET "tenant_id" = 'tenant-default'
WHERE "tenant_id" IS NULL;

UPDATE "users"
SET "idp_user_id" = "id"
WHERE "idp_user_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "idp_user_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_name_key" ON "tenants"("name");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE UNIQUE INDEX "users_idp_provider_idp_user_id_key" ON "users"("idp_provider", "idp_user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;