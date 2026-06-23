import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, type Observable } from "rxjs";

import type { AuthenticatedRequest, SessionPayload } from "../auth/types";
import {
  SENSITIVE_METADATA_KEY,
  type SensitiveMetadata,
  type SensitiveOptions,
} from "./sensitive.decorator";

const OMIT = Symbol("omit-sensitive-field");

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return next.handle().pipe(map((value) => this.sanitizeValue(value, request.user)));
  }

  private sanitizeValue(value: unknown, user: SessionPayload | undefined): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item, user));
    if (!value || typeof value !== "object" || value instanceof Date) return value;

    const metadata = this.reflector.get<SensitiveMetadata>(
      SENSITIVE_METADATA_KEY,
      value.constructor,
    );
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const options = metadata?.[key];
      if (options && this.shouldMask(options, user)) {
        const masked = this.maskValue(key, raw);
        if (masked !== OMIT) output[key] = masked;
        continue;
      }
      output[key] = this.sanitizeValue(raw, user);
    }
    return output;
  }

  private shouldMask(options: SensitiveOptions, user: SessionPayload | undefined): boolean {
    if (!user) return false;
    if ((user.isExternal || user.role === "external") && options.maskFor.includes("external")) {
      return true;
    }
    return options.maskFor.includes(user.role);
  }

  private maskValue(propertyName: string, value: unknown): string | typeof OMIT | unknown {
    const key = propertyName.toLowerCase();
    if (key.includes("amount") || key.includes("contract")) return OMIT;
    if (key.includes("email") && typeof value === "string") return maskEmail(value);
    if ((key.includes("phone") || key.includes("mobile")) && typeof value === "string") {
      return maskPhone(value);
    }
    if (typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return maskEmail(value);
    }
    if (typeof value === "string" && /^\d{11}$/.test(value)) return maskPhone(value);
    return value;
  }
}

function maskPhone(value: string): string {
  if (!/^\d{11}$/.test(value)) return value;
  return `${value.slice(0, 3)}****${value.slice(7)}`;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  return `${local.slice(0, 1)}***@${domain}`;
}
