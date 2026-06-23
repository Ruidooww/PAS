import { randomUUID } from "node:crypto";

import type { IdpProvider, UserProfile } from "@pas/clients";
import type { UserRole } from "@pas/shared";

import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, type SessionClaims } from "./types";

export const AUTH_USER_STORE = Symbol("AUTH_USER_STORE");

export type AuthUser = SessionClaims;

export interface AuthUserStore {
  upsertFromProfile(provider: IdpProvider, profile: UserProfile): Promise<AuthUser>;
  findById(id: string): Promise<AuthUser | null>;
}

interface AuthUserRow {
  id: string;
  tenant_id: string;
  idp_provider: IdpProvider;
  idp_user_id: string;
  name: string;
  email: string | null;
  role: UserRole;
  is_external: boolean;
  dept_id: string | null;
}

function rowToAuthUser(row: AuthUserRow): AuthUser {
  return {
    uid: row.id,
    tenantId: row.tenant_id,
    idpProvider: row.idp_provider,
    idpUserId: row.idp_user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    isExternal: row.is_external,
    deptId: row.dept_id,
  };
}

export class InMemoryAuthUserStore implements AuthUserStore {
  private readonly users = new Map<string, AuthUser>();
  private sequence = 0;

  async upsertFromProfile(provider: IdpProvider, profile: UserProfile): Promise<AuthUser> {
    const key = `${provider}:${profile.idpUserId}`;
    const existing = this.users.get(key);
    const user: AuthUser = {
      uid: existing?.uid ?? `user-${++this.sequence}`,
      tenantId: DEFAULT_TENANT_ID,
      idpProvider: provider,
      idpUserId: profile.idpUserId,
      name: profile.name,
      email: profile.email ?? null,
      role: "presales",
      isExternal: false,
      deptId: profile.deptIds?.[0] ?? null,
    };
    this.users.set(key, user);
    return user;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return [...this.users.values()].find((u) => u.uid === id) ?? null;
  }
}

export class PrismaAuthUserStore implements AuthUserStore {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromProfile(provider: IdpProvider, profile: UserProfile): Promise<AuthUser> {
    await this.prisma.$executeRaw`
      INSERT INTO "tenants" ("id", "name")
      VALUES (${DEFAULT_TENANT_ID}, ${DEFAULT_TENANT_NAME})
      ON CONFLICT ("id") DO NOTHING
    `;
    const deptId = profile.deptIds?.[0] ?? null;
    const email = profile.email ?? null;
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<AuthUserRow[]>`
      INSERT INTO "users" (
        "id", "tenant_id", "idp_provider", "idp_user_id", "name", "email",
        "role", "is_external", "dept_id", "last_login_at"
      )
      VALUES (
        ${id}, ${DEFAULT_TENANT_ID}, ${provider}::"IdpProvider",
        ${profile.idpUserId}, ${profile.name}, ${email}, 'presales'::"UserRole",
        false, ${deptId}, NOW()
      )
      ON CONFLICT ("idp_provider", "idp_user_id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "dept_id" = EXCLUDED."dept_id",
        "last_login_at" = NOW()
      RETURNING
        "id", "tenant_id", "idp_provider", "idp_user_id", "name", "email",
        "role", "is_external", "dept_id"
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to upsert auth user");
    return rowToAuthUser(row);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const rows = await this.prisma.$queryRaw<AuthUserRow[]>`
      SELECT
        "id", "tenant_id", "idp_provider", "idp_user_id", "name", "email",
        "role", "is_external", "dept_id"
      FROM "users"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    return row ? rowToAuthUser(row) : null;
  }
}