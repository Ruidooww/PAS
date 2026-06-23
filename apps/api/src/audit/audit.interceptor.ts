import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { catchError, tap, throwError, type Observable } from "rxjs";

import { AuditService } from "./audit.service";
import {
  type AuditHttpRequest,
  type AuditHttpResponse,
  requestAction,
  requestResource,
  requestUser,
} from "./audit-http";
import { InternalOnlyForbiddenException } from "../internal/internal-only.exception";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuditHttpRequest>();
    const response = http.getResponse<AuditHttpResponse>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const user = requestUser(request);
        this.audit
          .write({
            action: requestAction(request),
            resource: requestResource(request),
            userId: user?.uid ?? null,
            isExternal: user ? user.isExternal || user.role === "external" : false,
            detailJson: {
              result: "success",
              statusCode: response?.statusCode ?? 200,
              durationMs: Date.now() - startedAt,
            },
          })
          .catch((err: unknown) => console.error("[audit] interceptor write rejected", { err }));
      }),
      catchError((error: unknown) => {
        if (!(error instanceof InternalOnlyForbiddenException)) {
          const user = requestUser(request);
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "getStatus" in error &&
            typeof error.getStatus === "function"
              ? (error.getStatus() as number)
              : 500;
          this.audit
            .write({
              action: requestAction(request),
              resource: requestResource(request),
              userId: user?.uid ?? null,
              isExternal: user ? user.isExternal || user.role === "external" : false,
              detailJson: {
                result: "error",
                statusCode,
                durationMs: Date.now() - startedAt,
              },
            })
            .catch((err: unknown) => console.error("[audit] interceptor write rejected", { err }));
        }
        return throwError(() => error);
      }),
    );
  }
}
