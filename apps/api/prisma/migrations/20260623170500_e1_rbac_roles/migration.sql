-- Align role enum with E1.4 RBAC roles.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM (
  'admin',
  'presales',
  'aftersales',
  'implementation',
  'external'
);

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE "role"::text
      WHEN 'sales' THEN 'presales'
      WHEN 'delivery' THEN 'implementation'
      ELSE "role"::text
    END
  )::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'presales';

DROP TYPE "UserRole_old";
