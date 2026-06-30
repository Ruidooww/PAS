const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`
    INSERT INTO "tenants" ("id", "name")
    VALUES ('tenant-default', 'PAS Default Tenant')
    ON CONFLICT ("id") DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO "users" (
      "id",
      "tenant_id",
      "idp_provider",
      "idp_user_id",
      "name",
      "email",
      "role",
      "is_external",
      "dept_id",
      "last_login_at"
    )
    VALUES (
      'mock-user-1',
      'tenant-default',
      'mock'::"IdpProvider",
      'mock-user-1',
      'Mock 售前',
      'mock.presales@example.com',
      'presales'::"UserRole",
      false,
      'dept-presales',
      NOW()
    )
    ON CONFLICT ("idp_provider", "idp_user_id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "email" = EXCLUDED."email",
      "dept_id" = EXCLUDED."dept_id"
  `;
  await prisma.$executeRaw`
    INSERT INTO "kb_documents" (
      "id",
      "ragflow_doc_id",
      "ragflow_kb_id",
      "name",
      "product",
      "acl_scope",
      "uploaded_by"
    )
    VALUES
      ('kb-doc-public', 'mock-document', 'e0-mock-kb', 'Public product FAQ', 'pas', 'public', 'mock-user-1'),
      ('kb-doc-internal', 'mock-internal-document', 'e0-mock-kb', 'Internal sales playbook', 'pas', 'internal', 'mock-user-1'),
      ('kb-doc-presales', 'mock-presales-document', 'e0-mock-kb', 'Presales checklist', 'pas', 'role:presales', 'mock-user-1'),
      ('kb-doc-dept', 'mock-dept-presales-document', 'e0-mock-kb', 'Presales department notes', 'pas', 'dept:dept-presales', 'mock-user-1')
    ON CONFLICT ("ragflow_doc_id") DO UPDATE SET
      "ragflow_kb_id" = EXCLUDED."ragflow_kb_id",
      "name" = EXCLUDED."name",
      "product" = EXCLUDED."product",
      "acl_scope" = EXCLUDED."acl_scope",
      "uploaded_by" = EXCLUDED."uploaded_by"
  `;

  await prisma.$executeRaw`
    INSERT INTO "kg_entity_products" ("id", "name", "category", "vendor", "aliases", "metadata")
    VALUES
      ('kg-product-ip-guard', 'IP-Guard', 'DLP', 'HYYA', ARRAY['ipg', 'ip-guard'], '{"deployment":"private"}'::jsonb),
      ('kg-product-data-safe', 'DataSafe', 'DLP', 'HYYA', ARRAY['datasafe'], '{}'::jsonb),
      ('kg-product-endpoint-shield', 'Endpoint Shield', 'Endpoint Security', 'HYYA', ARRAY['endpoint-shield'], '{}'::jsonb),
      ('kg-product-audit-center', 'Audit Center', 'Audit', 'HYYA', ARRAY['audit-center'], '{}'::jsonb),
      ('kg-product-secure-gateway', 'Secure Gateway', 'Network Security', 'HYYA', ARRAY['secure-gateway'], '{}'::jsonb)
    ON CONFLICT ("name") DO UPDATE SET
      "category" = EXCLUDED."category",
      "vendor" = EXCLUDED."vendor",
      "aliases" = EXCLUDED."aliases",
      "metadata" = EXCLUDED."metadata"
  `;

  await prisma.$executeRaw`
    INSERT INTO "kg_entity_customers" ("id", "name", "industry", "scale", "crm_id")
    VALUES
      ('kg-customer-abc-bank', 'ABC Bank', 'Finance', 'large', 'crm-abc-bank'),
      ('kg-customer-east-manufacturing', 'East Manufacturing', 'Manufacturing', 'medium', 'crm-east-mfg'),
      ('kg-customer-metro-hospital', 'Metro Hospital', 'Healthcare', 'medium', 'crm-metro-hospital'),
      ('kg-customer-city-energy', 'City Energy', 'Energy', 'large', 'crm-city-energy'),
      ('kg-customer-north-school', 'North School', 'Education', 'small', 'crm-north-school')
    ON CONFLICT ("name") DO UPDATE SET
      "industry" = EXCLUDED."industry",
      "scale" = EXCLUDED."scale",
      "crm_id" = EXCLUDED."crm_id"
  `;

  await prisma.$executeRaw`
    INSERT INTO "kg_entity_industries" ("id", "name", "code", "parent_id")
    VALUES
      ('kg-industry-finance', 'Finance', 'FIN', NULL),
      ('kg-industry-manufacturing', 'Manufacturing', 'MFG', NULL),
      ('kg-industry-healthcare', 'Healthcare', 'HLTH', NULL),
      ('kg-industry-energy', 'Energy', 'ENERGY', NULL),
      ('kg-industry-education', 'Education', 'EDU', NULL)
    ON CONFLICT ("name") DO UPDATE SET
      "code" = EXCLUDED."code",
      "parent_id" = EXCLUDED."parent_id"
  `;

  await prisma.$executeRaw`
    INSERT INTO "kg_entity_proposals" ("id", "title", "customer_id", "template_id", "chapters")
    VALUES
      ('kg-proposal-finance-dlp', 'Finance DLP proposal', 'kg-customer-abc-bank', 'ip-guard-standard-v1', ARRAY['background', 'solution']),
      ('kg-proposal-manufacturing-endpoint', 'Manufacturing endpoint proposal', 'kg-customer-east-manufacturing', 'ip-guard-standard-v1', ARRAY['risk', 'architecture']),
      ('kg-proposal-healthcare-audit', 'Healthcare audit proposal', 'kg-customer-metro-hospital', 'audit-standard-v1', ARRAY['compliance', 'audit']),
      ('kg-proposal-energy-gateway', 'Energy gateway proposal', 'kg-customer-city-energy', 'gateway-standard-v1', ARRAY['network', 'deployment']),
      ('kg-proposal-education-dlp', 'Education DLP proposal', 'kg-customer-north-school', 'ip-guard-standard-v1', ARRAY['data', 'operation'])
    ON CONFLICT ("title") DO UPDATE SET
      "customer_id" = EXCLUDED."customer_id",
      "template_id" = EXCLUDED."template_id",
      "chapters" = EXCLUDED."chapters"
  `;

  await prisma.$executeRaw`
    INSERT INTO "kg_relations" (
      "id",
      "from_entity_type",
      "from_id",
      "to_entity_type",
      "to_id",
      "relation_type",
      "weight",
      "source"
    )
    VALUES
      ('kg-relation-finance-proposal-product', 'proposal'::"KgEntityType", 'kg-proposal-finance-dlp', 'product'::"KgEntityType", 'kg-product-ip-guard', 'PRODUCT_USES'::"KgRelationType", 0.95, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-abc-bank-product', 'customer'::"KgEntityType", 'kg-customer-abc-bank', 'product'::"KgEntityType", 'kg-product-ip-guard', 'CUSTOMER_BUYS'::"KgRelationType", 0.9, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-finance-customer', 'industry'::"KgEntityType", 'kg-industry-finance', 'customer'::"KgEntityType", 'kg-customer-abc-bank', 'INDUSTRY_HAS_CUSTOMER'::"KgRelationType", 0.9, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-mfg-proposal-product', 'proposal'::"KgEntityType", 'kg-proposal-manufacturing-endpoint', 'product'::"KgEntityType", 'kg-product-endpoint-shield', 'PRODUCT_USES'::"KgRelationType", 0.86, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-mfg-customer-product', 'customer'::"KgEntityType", 'kg-customer-east-manufacturing', 'product'::"KgEntityType", 'kg-product-endpoint-shield', 'CUSTOMER_BUYS'::"KgRelationType", 0.84, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-healthcare-customer-product', 'customer'::"KgEntityType", 'kg-customer-metro-hospital', 'product'::"KgEntityType", 'kg-product-audit-center', 'CUSTOMER_BUYS'::"KgRelationType", 0.82, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-energy-customer-product', 'customer'::"KgEntityType", 'kg-customer-city-energy', 'product'::"KgEntityType", 'kg-product-secure-gateway', 'CUSTOMER_BUYS'::"KgRelationType", 0.81, '{"seed":"m7.1"}'::jsonb),
      ('kg-relation-education-customer-product', 'customer'::"KgEntityType", 'kg-customer-north-school', 'product'::"KgEntityType", 'kg-product-data-safe', 'CUSTOMER_BUYS'::"KgRelationType", 0.8, '{"seed":"m7.1"}'::jsonb)
    ON CONFLICT ("from_entity_type", "from_id", "to_entity_type", "to_id", "relation_type") DO UPDATE SET
      "weight" = EXCLUDED."weight",
      "source" = EXCLUDED."source"
  `;
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
