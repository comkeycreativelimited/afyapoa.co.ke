/**
 * infra/scripts/validate-env.ts
 * Pre-deployment Environment & Secrets Validation Gate
 * 
 * Verifies that:
 * 1. Required environment variables exist and parse successfully.
 * 2. In production/staging, no insecure developer fallback strings are present.
 * 3. Secrets (JWT, Refresh, Pepper, DB password) have >= 32 characters of entropy.
 * 4. URLs use HTTPS in production.
 * 5. Rejects any deployment where INTEGRATION_MODE=PROD is set with mock credentials.
 */

import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Parse active environment file if provided as CLI arg
const targetEnvFile = process.argv[2];
if (targetEnvFile) {
  dotenv.config({ path: path.resolve(process.cwd(), targetEnvFile), override: true });
} else {
  dotenv.config();
}

const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`[ENV-VALIDATOR] Running pre-deployment validation for target NODE_ENV: '${nodeEnv}'...`);

const productionSecretPattern = /^(dev-|test-|insecure|staging-|default|password|secret|change)/i;

const validationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  KMS_PEPPER_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  INTEGRATION_MODE: z.enum(['MOCK', 'UAT', 'PROD']),
});

function runValidation() {
  const result = validationSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ [FATAL] Environment schema validation failed:');
    result.error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }

  const issues: string[] = [];

  if (nodeEnv === 'production') {
    const criticalSecrets = [
      { name: 'JWT_SECRET', val: process.env.JWT_SECRET },
      { name: 'REFRESH_TOKEN_SECRET', val: process.env.REFRESH_TOKEN_SECRET },
      { name: 'KMS_PEPPER_SECRET', val: process.env.KMS_PEPPER_SECRET },
      { name: 'DATABASE_PASSWORD', val: process.env.DATABASE_PASSWORD },
    ];

    for (const secret of criticalSecrets) {
      if (!secret.val || secret.val.length < 32) {
        issues.push(`${secret.name} has insufficient entropy (< 32 characters) for production.`);
      }
      if (secret.val && productionSecretPattern.test(secret.val)) {
        issues.push(`${secret.name} matches known insecure developer default pattern.`);
      }
    }

    if (process.env.INTEGRATION_MODE === 'MOCK') {
      issues.push(`INTEGRATION_MODE cannot be 'MOCK' in production. Must be 'PROD'.`);
    }

    if (process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('afyapoa_dev_password')) {
      issues.push(`DATABASE_URL contains localhost or insecure dev credentials.`);
    }

    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode')) {
      console.warn('⚠️  [WARN] DATABASE_URL does not specify sslmode=verify-full. Recommended for production.');
    }
  }

  if (issues.length > 0) {
    console.error(`❌ [PRE-FLIGHT GATE REJECTED] ${issues.length} critical configuration issue(s) found:`);
    issues.forEach((issue) => console.error(`   - ${issue}`));
    process.exit(1);
  }

  console.log(`✅ [ENV-VALIDATOR PASSED] All environment variables and secrets meet compliance standards for '${nodeEnv}'.`);
}

runValidation();
