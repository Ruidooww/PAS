import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { SessionClaims } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

export type FieldAclAction = "read" | "write";

export interface FieldAclUserClaims extends SessionClaims {
  dept?: string | null;
  project_group?: string | null;
  projectGroup?: string | null;
  employment_status?: string | null;
  employmentStatus?: string | null;
}

interface FieldAclRow {
  fieldName: string;
  requiredRoles: string[];
  requiredAttrs: Prisma.JsonValue;
}

type FieldMap = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;

@Injectable()
export class FieldAclService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async filterFields<T extends FieldMap>(
    resourceType: string,
    resourceId: string,
    fields: T,
    userClaims: FieldAclUserClaims,
    action: FieldAclAction = "read",
  ): Promise<Partial<T>> {
    const fieldNames = Object.keys(fields);
    if (fieldNames.length === 0) return {};

    const aclRows = await this.prisma.fieldAcl.findMany({
      where: {
        resourceType,
        resourceId: { in: [resourceId, "*"] },
        fieldName: { in: fieldNames },
      },
      orderBy: [{ resourceId: "desc" }, { createdAt: "desc" }],
    });
    const rowsByField = groupRowsByField(aclRows);
    const filtered: Partial<T> = {};
    const auditWrites: Array<Promise<unknown>> = [];

    for (const fieldName of fieldNames) {
      const rows = rowsByField.get(fieldName) ?? [];
      const denial = denyReason(rows, userClaims);
      if (!denial) {
        filtered[fieldName as keyof T] = fields[fieldName] as T[keyof T];
        continue;
      }
      auditWrites.push(
        this.prisma.aclAuditLog.create({
          data: {
            userId: userClaims.uid,
            resourceType,
            resourceId,
            fieldName,
            action: `field_${action}_filter`,
            reason: denial,
          },
        }),
      );
    }

    await Promise.all(auditWrites);
    return filtered;
  }
}

function groupRowsByField(rows: FieldAclRow[]): Map<string, FieldAclRow[]> {
  const grouped = new Map<string, FieldAclRow[]>();
  for (const row of rows) {
    grouped.set(row.fieldName, [...(grouped.get(row.fieldName) ?? []), row]);
  }
  return grouped;
}

function denyReason(rows: FieldAclRow[], userClaims: FieldAclUserClaims): string | undefined {
  if (rows.length === 0) return undefined;
  for (const row of rows) {
    const roleDenied = denyByRole(row.requiredRoles, userClaims);
    if (roleDenied) return roleDenied;
    const attrDenied = denyByAttrs(row.requiredAttrs, userClaims);
    if (attrDenied) return attrDenied;
  }
  return undefined;
}

function denyByRole(requiredRoles: string[], userClaims: FieldAclUserClaims): string | undefined {
  if (requiredRoles.length === 0) return undefined;
  const role = String(userClaims.role);
  if (role === "admin" || requiredRoles.includes(role)) return undefined;
  return "required_roles_denied";
}

function denyByAttrs(
  requiredAttrs: Prisma.JsonValue,
  userClaims: FieldAclUserClaims,
): string | undefined {
  const root = asRecord(requiredAttrs);
  if (!root) return undefined;
  const userAttrs = asRecord(root.user ?? root);
  if (!userAttrs) return undefined;
  const claims = normalizedUserAttrs(userClaims);

  for (const [attrName, required] of Object.entries(userAttrs)) {
    if (!matchesRequiredValue(claims[attrName], required)) {
      return `required_attr_denied:${attrName}`;
    }
  }
  return undefined;
}

function normalizedUserAttrs(userClaims: FieldAclUserClaims): JsonRecord {
  return {
    role: String(userClaims.role),
    dept: userClaims.dept ?? userClaims.deptId,
    project_group: userClaims.project_group ?? userClaims.projectGroup,
    employment_status:
      userClaims.employment_status ?? userClaims.employmentStatus ?? "active",
  };
}

function matchesRequiredValue(actual: unknown, required: unknown): boolean {
  if (Array.isArray(required)) {
    return required.some((candidate) => matchesRequiredValue(actual, candidate));
  }
  return actual !== undefined && actual !== null && String(actual) === String(required);
}

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}
