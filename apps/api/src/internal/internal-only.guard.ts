import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthenticatedRequest } from "../auth/types";

@Injectable()
export class InternalOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.isExternal) {
      throw new ForbiddenException("External users cannot access internal routes");
    }
    return true;
  }
}
