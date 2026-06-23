import { z } from "zod";

export const envSchema = z
  .object({
    CRM_API_KEY: z.string().min(1),
    CRM_BASE_URL: z.string().url(),
    CRM_PROVIDER: z.enum(["external", "pas"]),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    IDP_MODE: z.enum(["mock", "real"]),
    FEISHU_APP_ID: z.string().min(1),
    FEISHU_APP_SECRET: z.string().min(1),
    FEISHU_REDIRECT_URI: z.string().url(),
    LLM_API_KEY: z.string().min(1),
    LLM_BASE_URL: z.string().url(),
    LLM_CLIENT_MODE: z.enum(["mock", "real"]),
    LLM_MODEL: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    MINIO_BUCKET: z.string().min(1),
    MINIO_ENDPOINT: z.string().url(),
    MINIO_SECRET_KEY: z.string().min(1),
    PORT: z.coerce.number().int().positive().max(65_535).default(3001),
    RAGFLOW_API_KEY: z.string().min(1),
    RAGFLOW_BASE_URL: z.string().url(),
    RAGFLOW_CLIENT_MODE: z.enum(["mock", "real"]),
    REDIS_URL: z.string().url(),
    WECOM_AGENT_ID: z.string().min(1),
    WECOM_APP_SECRET: z.string().min(1),
    WECOM_CORP_ID: z.string().min(1),
    WECOM_REDIRECT_URI: z.string().url(),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (env.IDP_MODE === "mock" && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IDP_MODE"],
        message: "IDP_MODE=mock cannot be used when NODE_ENV=production",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return envSchema.parse(config);
}