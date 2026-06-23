import type { UserRole } from "@pas/shared";

export const SENSITIVE_METADATA_KEY = Symbol("pas:sensitive");

export interface SensitiveOptions {
  maskFor: Array<UserRole | "external">;
}

export type SensitiveMetadata = Record<string, SensitiveOptions>;

export function Sensitive(options: SensitiveOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const constructor = target.constructor;
    const existing =
      (Reflect.getMetadata(SENSITIVE_METADATA_KEY, constructor) as SensitiveMetadata | undefined) ??
      {};
    Reflect.defineMetadata(
      SENSITIVE_METADATA_KEY,
      { ...existing, [String(propertyKey)]: options },
      constructor,
    );
  };
}
