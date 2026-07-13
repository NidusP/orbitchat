import { z } from 'zod';

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .regex(/^postgresql:\/\/.+/, 'DATABASE_URL must be a PostgreSQL connection string'),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    LLM_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
    LLM_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().min(1).default('llama3.2'),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    AI_MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().default(2),
    LLM_E2E_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
    RAG_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    STORAGE_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).default('orbitchat'),
  })
  .superRefine((data, ctx) => {
    if (!data.STORAGE_ENABLED) {
      return;
    }
    if (!data.S3_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_ENDPOINT'],
        message: 'S3_ENDPOINT is required when STORAGE_ENABLED=true',
      });
    }
    if (!data.S3_ACCESS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_ACCESS_KEY'],
        message: 'S3_ACCESS_KEY is required when STORAGE_ENABLED=true',
      });
    }
    if (!data.S3_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_SECRET_KEY'],
        message: 'S3_SECRET_KEY is required when STORAGE_ENABLED=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
