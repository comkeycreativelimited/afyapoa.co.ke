import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql as dSql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '@afyapoa/config';

export * from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

let queryClient: postgres.Sql | null = null;
let dbInstance: Database | null = null;

/**
 * Returns connection URL for the non-superuser application role (afyapoa_app)
 * ensuring PostgreSQL Row-Level Security policies are strictly enforced.
 */
export function getAppDatabaseUrl(): string {
  if (config.DATABASE_URL.includes('afyapoa_user')) {
    return config.DATABASE_URL.replace('afyapoa_user', 'afyapoa_app');
  }
  return config.DATABASE_URL;
}

export function getDatabaseClient(connectionUrl: string = getAppDatabaseUrl()) {
  if (!queryClient) {
    queryClient = postgres(connectionUrl, {
      max: config.DATABASE_POOL_MAX,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzle(queryClient, { schema });
  }
  return { db: dbInstance!, sql: queryClient };
}

/**
 * Executes a transaction with PostgreSQL Row-Level Security tenant context:
 * SELECT set_config('app.current_tenant_id', :tenantId, true)
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
  connectionUrl: string = getAppDatabaseUrl(),
): Promise<T> {
  const { db } = getDatabaseClient(connectionUrl);
  return await db.transaction(async (tx) => {
    // Reset super-admin flag and set transaction-local tenant context safely using set_config
    await tx.execute(dSql`SELECT set_config('app.is_super_admin', 'false', true)`);
    await tx.execute(dSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return await fn(tx as unknown as PostgresJsDatabase<typeof schema>);
  });
}

/**
 * Alias for withTenantContext explicitly emphasizing ACID transaction boundary guarantees.
 */
export const withTenantTransaction = withTenantContext;

/**
 * Executes a transaction with PostgreSQL super-admin context bypassing tenant isolation:
 * SELECT set_config('app.is_super_admin', 'true', true)
 */
export async function withSuperAdminContext<T>(
  fn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
  connectionUrl: string = getAppDatabaseUrl(),
): Promise<T> {
  const { db } = getDatabaseClient(connectionUrl);
  return await db.transaction(async (tx) => {
    await tx.execute(dSql`SELECT set_config('app.is_super_admin', 'true', true)`);
    return await fn(tx as unknown as PostgresJsDatabase<typeof schema>);
  });
}

