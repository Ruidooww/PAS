import type { PrismaClient } from "@prisma/client";

import { JwtSessionService } from "../../../api/src/auth/jwt-session.service";
import { SESSION_COOKIE_NAME, type SessionClaims } from "../../../api/src/auth/types";

const externalClaims: SessionClaims = {
  uid: "external-e2e-user",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "external-e2e-user",
  name: "External E2E User",
  email: "external.e2e@example.com",
  role: "external",
  isExternal: true,
  deptId: null,
};

export function externalSessionCookie(): string {
  const jwt = new JwtSessionService(
    process.env.JWT_SECRET ?? "e2e-secret-at-least-32-characters-long",
    604_800,
  );
  return `${SESSION_COOKIE_NAME}=${jwt.sign(externalClaims)}`;
}

export async function seedExternalUser(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: externalClaims.tenantId },
    create: { id: externalClaims.tenantId, name: "PAS Default Tenant" },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: externalClaims.uid },
    create: {
      id: externalClaims.uid,
      tenantId: externalClaims.tenantId,
      idpProvider: externalClaims.idpProvider,
      idpUserId: externalClaims.idpUserId,
      name: externalClaims.name,
      email: externalClaims.email,
      role: externalClaims.role,
      isExternal: externalClaims.isExternal,
      deptId: externalClaims.deptId,
    },
    update: {
      role: externalClaims.role,
      isExternal: externalClaims.isExternal,
      deptId: externalClaims.deptId,
    },
  });
}

export async function cleanupExternalUser(prisma: PrismaClient): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { userId: externalClaims.uid } });
  await prisma.user.deleteMany({ where: { id: externalClaims.uid } });
}
