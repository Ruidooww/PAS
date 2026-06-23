import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@pas/shared";

export const ROLES_KEY = "pas:roles";

export function Roles(...roles: UserRole[]) {
  return SetMetadata(ROLES_KEY, roles);
}
