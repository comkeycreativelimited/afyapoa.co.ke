import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { config } from '@afyapoa/config';
import { withSuperAdminContext, withTenantTransaction } from './index.js';
import { patientRecords, tenants } from './schema.js';
import { eq } from 'drizzle-orm';

describe('Database Migration & Schema Catalog Verification Tests', () => {
  const sql = postgres(config.DATABASE_URL, { max: 2 });

  it('verifies that all critical tenant-scoped and clinical tables exist in information_schema', async () => {
    const requiredTables = [
      'tenants',
      'facilities',
      'users',
      'practitioner_profiles',
      'user_sessions',
      'audit_events',
      'patients',
      'patient_identifiers',
      'patient_consents',
      'encounters',
      'triage_vitals',
      'clinical_notes',
      'diagnoses',
      'clinical_orders',
      'medication_requests',
      'service_requests',
      'lab_test_catalog',
      'lab_specimens',
      'lab_results',
      'diagnostic_reports',
      'pharmacy_products',
      'pharmacy_batches',
      'medication_dispenses',
      'invoices',
      'invoice_line_items',
      'payments',
      'sha_claims',
      'sha_claim_items',
      'sha_preauthorizations',
      'wards',
      'beds',
      'inpatient_admissions',
      'theatres',
      'theatre_bookings',
      'integration_configs',
      'external_references',
      'job_executions',
    ];

    const existingTablesResult = await sql<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    const existingTableNames = new Set(existingTablesResult.map((r) => r.table_name));

    for (const tableName of requiredTables) {
      expect(
        existingTableNames.has(tableName),
        `Table '${tableName}' must be present in PostgreSQL public schema catalog`,
      ).toBe(true);
    }
  });

  it('verifies that Row Level Security (RLS) is actively enabled across all tenant-scoped tables', async () => {
    const rlsTablesResult = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
        AND c.relrowsecurity = true;
    `;

    const rlsTableNames = new Set(rlsTablesResult.map((r) => r.relname));

    const sampleRlsTables = [
      'patient_records',
      'patients',
      'encounters',
      'triage_vitals',
      'clinical_notes',
      'clinical_orders',
      'medication_requests',
      'service_requests',
      'invoices',
      'payments',
      'sha_claims',
      'audit_events',
      'wards',
      'beds',
      'theatre_bookings',
    ];

    for (const table of sampleRlsTables) {
      expect(
        rlsTableNames.has(table),
        `Table '${table}' must have relrowsecurity = true in pg_class`,
      ).toBe(true);
    }
  });

  it('verifies that tenant isolation policies exist in pg_policy', async () => {
    const policiesResult = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `;

    expect(policiesResult.length).toBeGreaterThan(0);
    const policyMap = new Map<string, string[]>();
    for (const p of policiesResult) {
      if (!policyMap.has(p.tablename)) policyMap.set(p.tablename, []);
      policyMap.get(p.tablename)!.push(p.policyname);
    }

    expect(policyMap.has('patient_records')).toBe(true);
    expect(policyMap.get('patient_records')).toContain('patient_records_isolation_policy');

    expect(policyMap.has('audit_events')).toBe(true);
    expect(policyMap.get('audit_events')).toContain('audit_events_select_policy');
    expect(policyMap.get('audit_events')).toContain('audit_events_insert_policy');

    expect(policyMap.has('sha_claims')).toBe(true);
    expect(policyMap.get('sha_claims')).toContain('sha_claims_isolation_policy');

    expect(policyMap.has('invoices')).toBe(true);
    expect(policyMap.get('invoices')).toContain('invoices_isolation_policy');
  });

  it('verifies transaction rollback on foreign key or constraint violation without data leakage', async () => {
    let seededTenantId: string;
    await withSuperAdminContext(async (db) => {
      const [t] = await db.select().from(tenants).where(eq(tenants.code, 'tenant-nmhg')).limit(1);
      seededTenantId = t.id;
    });

    const nonExistentFacilityId = '00000000-0000-0000-0000-000000009999';
    const testRecordNum = `FAIL-TX-${Date.now()}`;

    // Executing an operation with invalid foreign key must throw and rollback
    await expect(
      withTenantTransaction(seededTenantId!, async (tx) => {
        await tx.insert(patientRecords).values({
          tenantId: seededTenantId!,
          facilityId: nonExistentFacilityId,
          recordNumber: testRecordNum,
          patientAlias: 'GHOST-RECORD',
        });
      }),
    ).rejects.toThrow();

    // Verify record was rolled back and does not exist in database
    await withSuperAdminContext(async (db) => {
      const records = await db
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.recordNumber, testRecordNum));
      expect(records).toHaveLength(0);
    });
  });
});
