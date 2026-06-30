-- CreateEnum
CREATE TYPE "KgEntityType" AS ENUM ('product', 'proposal', 'customer', 'industry');

-- CreateEnum
CREATE TYPE "KgRelationType" AS ENUM ('PRODUCT_USES', 'CUSTOMER_BUYS', 'PROPOSAL_FOR_CUSTOMER', 'INDUSTRY_HAS_CUSTOMER', 'PRODUCT_COMPETES');

-- CreateTable
CREATE TABLE "kg_entity_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "vendor" TEXT,
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "kg_entity_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kg_entity_proposals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customer_id" TEXT,
    "template_id" TEXT,
    "chapters" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "kg_entity_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kg_entity_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "scale" TEXT,
    "crm_id" TEXT,

    CONSTRAINT "kg_entity_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kg_entity_industries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parent_id" TEXT,

    CONSTRAINT "kg_entity_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kg_relations" (
    "id" TEXT NOT NULL,
    "from_entity_type" "KgEntityType" NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_entity_type" "KgEntityType" NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation_type" "KgRelationType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "source" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_products_name_key" ON "kg_entity_products"("name");

-- CreateIndex
CREATE INDEX "kg_entity_products_name_idx" ON "kg_entity_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_proposals_title_key" ON "kg_entity_proposals"("title");

-- CreateIndex
CREATE INDEX "kg_entity_proposals_customer_id_idx" ON "kg_entity_proposals"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_customers_name_key" ON "kg_entity_customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_customers_crm_id_key" ON "kg_entity_customers"("crm_id");

-- CreateIndex
CREATE INDEX "kg_entity_customers_industry_idx" ON "kg_entity_customers"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_industries_name_key" ON "kg_entity_industries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kg_entity_industries_code_key" ON "kg_entity_industries"("code");

-- CreateIndex
CREATE INDEX "kg_entity_industries_parent_id_idx" ON "kg_entity_industries"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "kg_relations_unique_edge_type" ON "kg_relations"("from_entity_type", "from_id", "to_entity_type", "to_id", "relation_type");

-- CreateIndex
CREATE INDEX "kg_relations_from_entity_type_from_id_idx" ON "kg_relations"("from_entity_type", "from_id");

-- CreateIndex
CREATE INDEX "kg_relations_to_entity_type_to_id_idx" ON "kg_relations"("to_entity_type", "to_id");

-- CreateIndex
CREATE INDEX "kg_relations_relation_type_idx" ON "kg_relations"("relation_type");

-- AddForeignKey
ALTER TABLE "kg_entity_industries" ADD CONSTRAINT "kg_entity_industries_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kg_entity_industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
