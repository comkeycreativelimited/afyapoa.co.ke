/**
 * infra/scripts/db-migrate.ts
 * Production-Safe Database Migration Runner with PostgreSQL Advisory Locks
 * 
 * Prevents race conditions during multi-instance / rolling container deployments
 * by acquiring an exclusive session-level advisory lock before applying migrations.
 */

import postgres from 'postgres';
import { config } from '@afyapoa/config';

const MIGRATION_LOCK_ID = 987654321; // Dedicated integer key for schema migration locking

async function executeMigrationWithLock() {
  console.log('[DB-MIGRATE] Initializing zero-downtime migration runner...');
  const sql = postgres(config.DATABASE_URL, { max: 1 });

  try {
    console.log(`[DB-MIGRATE] Attempting to acquire advisory lock (${MIGRATION_LOCK_ID})...`);
    const [lockResult] = await sql`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_ID}) AS acquired;`;

    if (!lockResult || !lockResult.acquired) {
      console.error('❌ [DB-MIGRATE] Another migration process currently holds the advisory lock. Aborting safely.');
      process.exit(1);
    }

    console.log('🔒 [DB-MIGRATE] Advisory lock acquired successfully.');

    // 1. Ensure schema_migrations table exists for version tracking
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        git_sha VARCHAR(64),
        execution_duration_ms INTEGER
      );
    `;

    const startTime = Date.now();
    console.log('[DB-MIGRATE] Applying schema definitions and Row-Level Security policies...');

    // Run core migrations dynamically
    const { execSync } = await import('child_process');
    execSync('pnpm --filter @afyapoa/database db:migrate', {
      stdio: 'inherit',
      env: process.env,
    });

    const duration = Date.now() - startTime;
    const versionTag = `v1.0.0-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    await sql`
      INSERT INTO schema_migrations (version, git_sha, execution_duration_ms)
      VALUES (${versionTag}, ${process.env.GITHUB_SHA || 'local-deployment'}, ${duration})
      ON CONFLICT (version) DO NOTHING;
    `;

    console.log(`✅ [DB-MIGRATE] Migration completed in ${duration}ms. Logged version: ${versionTag}`);
  } catch (err) {
    console.error('❌ [DB-MIGRATE] Migration failed with error:', err);
    process.exit(1);
  } finally {
    try {
      await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID});`;
      console.log('🔓 [DB-MIGRATE] Advisory lock released.');
    } catch {
      // Ignore unlock cleanup errors on exit
    }
    await sql.end();
  }
}

executeMigrationWithLock();
