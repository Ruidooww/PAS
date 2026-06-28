import type { PrismaClient } from "@prisma/client";
import type { Agent } from "supertest";

import type { SessionPayload } from "../../../api/src/auth/types";

export interface LoginResult {
  agent: Agent;
  user: SessionPayload;
}

export async function loginWithMockIdp(
  agent: Agent,
  prisma: PrismaClient,
): Promise<LoginResult> {
  const login = await agent.get("/auth/login?provider=mock").redirects(0).expect(302);
  const location = login.headers.location;
  if (typeof location !== "string") throw new Error("Mock login did not return a redirect");
  const callback = new URL(location);
  await agent.get(`${callback.pathname}${callback.search}`).redirects(0).expect(302);

  const me = await agent.get("/api/me").expect(200);
  const user = me.body as SessionPayload;
  if (typeof user.uid !== "string" || user.uid.length === 0) {
    throw new Error("Mock login did not create a session user");
  }

  const row = await prisma.user.findUnique({ where: { id: user.uid }, select: { id: true } });
  if (!row) throw new Error(`Mock login user was not persisted: ${user.uid}`);
  return { agent, user };
}

export async function loginAsAdmin(agent: Agent, prisma: PrismaClient): Promise<LoginResult> {
  const firstLogin = await loginWithMockIdp(agent, prisma);
  await prisma.$executeRaw`
    UPDATE "users"
    SET "role" = 'admin'::"UserRole"
    WHERE "id" = ${firstLogin.user.uid}
  `;
  const adminLogin = await loginWithMockIdp(agent, prisma);
  if (adminLogin.user.role !== "admin") {
    throw new Error(`Mock admin login did not issue an admin session: ${adminLogin.user.uid}`);
  }
  return adminLogin;
}
