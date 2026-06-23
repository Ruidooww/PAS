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
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });