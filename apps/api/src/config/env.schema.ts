import { z } from "zod";

export const envSchema = z
  .object({
    CRM_API_KEY: z.string().min(1),
    CRM_BASE_URL: z.string().url(),
    CRM_PROVIDER: z.enum(["external", "pas"]),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    LLM_API_KEY: z.string().min(1),
    LLM_BASE_URL: z.string().url(),
    LLM_CLIENT_MODE: z.enum(["mock", "real"]),
    LLM_MODEL: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    MINIO_ENDPOINT: z.string().url(),
    MINIO_SECRET_KEY: z.string().min(1),
    PORT: z.coerce.number().int().positive().max(65_535).default(3001),
    RAGFLOW_API_KEY: z.string().min(1),
    RAGFLOW_BASE_URL: z.string().url(),
    RAGFLOW_CLIENT_MODE: z.enum(["mock", "real"]),
    REDIS_URL: z.string().url(),
  })
  .passthrough();

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return envSchema.parse(config);
}
