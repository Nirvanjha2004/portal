/**
 * Environment variable validation using Zod.
 * Import `env` instead of `process.env` throughout the app to get
 * type-safe, validated access to required environment variables.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
  // Optional integrations
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  INTERNAL_SECRET: z.string().min(8).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("❌ Invalid environment variables:", formatted);
    throw new Error(
      `Invalid environment variables:\n${result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    );
  }
  return result.data;
}

// Validate once at module load time (server-side only).
// On the client, only NEXT_PUBLIC_* vars are available — skip validation.
export const env: Env =
  typeof window === "undefined"
    ? validateEnv()
    : (process.env as unknown as Env);
