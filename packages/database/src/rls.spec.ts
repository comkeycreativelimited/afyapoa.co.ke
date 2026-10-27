import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabaseClient, withTenantContext, withSuperAdminContext } from './index.js';
import { tenants, patientRecords } from './schema.js';
import { eq } from 'drizzle-orm';
import { sql as dSql } from 'drizzle-orm';

describe('PostgreSQL Row-Level Security Multi-Tenant Isolation', () => {
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    // Retrieve the two seeded tenant IDs using super admin context
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded tenants not found in database');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;
    });
  });

  it('Tenant A can only read their own records, never Tenant B records', async () => {
    await withTenantContext(tenantAId, async (db) => {
      const records = await db.select().from(patientRecords);
      expect(records.length).toBeGreaterThan(0);
      for (const rec of records) {
        expect(rec.tenantId).toBe(tenantAId);
        expect(rec.tenantId).not.toBe(tenantBId);
      }
    });

    await withTenantContext(tenantBId, async (db) => {
      const records = await db.select().from(patientRecords);
      expect(records.length).toBeGreaterThan(0);
      for (const rec of records) {
        expect(rec.tenantId).toBe(tenantBId);
        expect(rec.tenantId).not.toBe(tenantAId);
      }
    });
  });

  it('Cross-tenant read by ID returns nothing under RLS', async () => {
    // Find a record belonging to Tenant B
    let tenantBRecordId = '';
    await withTenantContext(tenantBId, async (db) => {
      const [rec] = await db.select().from(patientRecords);
      expect(rec).toBeDefined();
      tenantBRecordId = rec!.id;
    });

    // Attempt to query Tenant B's record using Tenant A context
    await withTenantContext(tenantAId, async (db) => {
      const found = await db
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.id, tenantBRecordId));
      expect(found).toHaveLength(0); // RLS filtered it out completely
    });
  });

  it('Cross-tenant update is blocked or affects 0 rows under RLS', async () => {
    let tenantBRecordId = '';
    await withTenantContext(tenantBId, async (db) => {
      const [rec] = await db.select().from(patientRecords);
      tenantBRecordId = rec!.id;
    });

    // Attempt to mutate Tenant B's record while authenticated as Tenant A
    await withTenantContext(tenantAId, async (db) => {
      const result = await db
        .update(patientRecords)
        .set({ notes: 'TAMPERED_BY_ATTACKER' })
        .where(eq(patientRecords.id, tenantBRecordId))
        .returning();

      expect(result).toHaveLength(0); // 0 rows updated
    });

    // Verify Tenant B's record remains untampered
    await withTenantContext(tenantBId, async (db) => {
      const [rec] = await db
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.id, tenantBRecordId));
      expect(rec?.notes).not.toBe('TAMPERED_BY_ATTACKER');
    });
  });

  it('Cross-tenant insert is rejected by RLS WITH CHECK policy', async () => {
    // Attempt to insert a record with tenantId B while in tenant A context
    await expect(
      withTenantContext(tenantAId, async (db) => {
        // Find facility under tenant B
        const facilities = await db.execute(
          dSql`SELECT id FROM facilities WHERE tenant_id = ${tenantBId}::uuid LIMIT 1`,
        );
        const facilityId = (facilities[0] as any)?.id || '00000000-0000-0000-0000-000000000000';

        await db.insert(patientRecords).values({
          tenantId: tenantBId, // Mismatched tenantId!
          facilityId,
          recordNumber: 'ATTACK-REC-001',
          patientAlias: 'TAMPERED-PATIENT',
          notes: 'Illegal cross-tenant insert',
        });
      }),
    ).rejects.toThrow();
  });

  it('Querying without tenant context returns 0 rows (fail-closed)', async () => {
    const { db } = getDatabaseClient();
    await db.transaction(async (tx) => {
      await tx.execute(dSql`SELECT set_config('app.current_tenant_id', '', true)`);
      await tx.execute(dSql`SELECT set_config('app.is_super_admin', 'false', true)`);
      const records = await tx.select().from(patientRecords);
      expect(records).toHaveLength(0);
    });
  });

  it('Super admin context can view records across all tenants', async () => {
    await withSuperAdminContext(async (db) => {
      const allRecords = await db.select().from(patientRecords);
      const tenantIds = new Set(allRecords.map((r) => r.tenantId));
      expect(tenantIds.has(tenantAId)).toBe(true);
      expect(tenantIds.has(tenantBId)).toBe(true);
    });
  });
});
