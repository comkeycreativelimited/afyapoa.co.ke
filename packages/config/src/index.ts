import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root if not already loaded in process.env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(3000),
  MOCK_SERVER_PORT: z.coerce.number().default(4010),

  // Security
  JWT_SECRET: z.string().min(16).default('dev-insecure-jwt-secret-min-32-chars-length'),
  JWT_EXPIRATION: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(16).default('dev-insecure-refresh-token-secret'),
  REFRESH_TOKEN_EXPIRATION: z.string().default('7d'),
  KMS_PEPPER_SECRET: z.string().min(16).default('dev-insecure-hmac-sha256-blind-index-pepper-key'),

  // Database
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_USER: z.string().default('afyapoa_user'),
  DATABASE_PASSWORD: z.string().default('afyapoa_dev_password'),
  DATABASE_NAME: z.string().default('afyapoa_db'),
  DATABASE_URL: z
    .string()
    .default('postgresql://afyapoa_user:afyapoa_dev_password@localhost:5432/afyapoa_db'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Integration Mode: MOCK (synthetic local), UAT (authorized sandbox), PROD (verified production)
  INTEGRATION_MODE: z.enum(['MOCK', 'UAT', 'PROD']).default('MOCK'),
  INTEGRATION_DRIVER: z.enum(['MOCK', 'SANDBOX', 'PRODUCTION']).default('MOCK'),

  // DHA HIE Gateways
  DHA_HIE_BASE_URL: z.string().url().default('http://localhost:4010/dha'),
  DHA_HIE_UAT_URL: z.string().url().default('https://sandbox.hie.dha.go.ke'),
  DHA_HIE_PROD_URL: z.string().url().default('https://api.hie.dha.go.ke'),
  DHA_CLIENT_ID: z.string().default('dev-dha-client-id'),
  DHA_CLIENT_SECRET: z.string().default('dev-dha-client-secret'),
  DHA_DEFAULT_FACILITY_ID: z.string().default('FID-01-000001-1'),

  // SHA eClaims Gateways
  SHA_CLAIMS_BASE_URL: z.string().url().default('http://localhost:4010/sha'),
  SHA_CLAIMS_UAT_URL: z.string().url().default('https://sandbox.claims.sha.go.ke'),
  SHA_CLAIMS_PROD_URL: z.string().url().default('https://api.claims.sha.go.ke'),
  SHA_API_KEY: z.string().default('dev-sha-api-key'),
  SHA_FACILITY_CODE: z.string().default('FID-01-000001-1'),

  // KRA eTIMS Gateways
  KRA_ETIMS_BASE_URL: z.string().url().default('http://localhost:4010/etims'),
  KRA_ETIMS_UAT_URL: z.string().url().default('https://etims-sbx.kra.go.ke'),
  KRA_ETIMS_PROD_URL: z.string().url().default('https://etims.kra.go.ke'),
  KRA_ETIMS_PIN: z.string().default('P000000000A'),
  KRA_ETIMS_DEVICE_ID: z.string().default('ETIMS-DEV-DEVICE-001'),

  // M-Pesa
  MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_CONSUMER_KEY: z.string().default('dev-daraja-consumer-key'),
  MPESA_CONSUMER_SECRET: z.string().default('dev-daraja-consumer-secret'),
  MPESA_SHORTCODE: z.string().default('174379'),
  MPESA_PASSKEY: z.string().default('dev-daraja-passkey'),
  MPESA_CALLBACK_URL: z
    .string()
    .default('http://localhost:4000/api/v1/payments/mpesa/c2b-callback'),

  // Observability
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function loadConfig(env: Record<string, unknown> = process.env): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `[COMKEY AFYA POA] Configuration validation failed:\n${errorDetails}\nCheck your .env file against .env.example.`,
    );
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export const config = loadConfig();
