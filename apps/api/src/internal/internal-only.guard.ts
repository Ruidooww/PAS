import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import {
  type AuditHttpRequest,
  requestAction,
  requestResource,
  requestUser,
} from "../audit/audit-http";
import type { AuthenticatedRequest } from "../auth/types";

@Injectable()
export class InternalOnlyGuard implements CanActivate {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & AuditHttpRequest>();
    if (request.user?.isExternal || request.user?.role === "external") {
      const user = requestUser(request);
      const resource = requestResource(request);
      await this.audit.write({
        action: requestAction(request),
        resource,
        userId: user?.uid ?? null,
        isExternal: true,
        detailJson: {
          result: "forbidden_external_internal",
          statusCode: 403,
        },
      });
      console.warn("External internal route access denied", {
        userId: user?.uid ?? null,
        resource,
      });
      throw new ForbiddenException("External users cannot access internal routes");
    }
    return true;
  }
}
