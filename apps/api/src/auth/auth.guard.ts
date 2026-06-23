import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import type { AuthenticatedRequest } from "./types";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException("Authentication required");
    return true;
  }
}