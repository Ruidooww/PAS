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
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
