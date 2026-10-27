import { describe, it, expect, beforeAll } from 'vitest';
import { withTenantContext, withTenantTransaction, withSuperAdminContext } from './index.js';
import {
  tenants,
  facilities,
  patientRecords,
  workflowStateTransitions,
  patientIdentifiers,
} from './schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('Database Transaction Boundaries & ACID Guarantees', () => {
  let tenantAId: string;
  let tenantBId: string;
  let facilityAId: string;

  beforeAll(async () => {
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded tenants not found in database');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;

      const [facA] = await db
        .select()
        .from(facilities)
        .where(eq(facilities.tenantId, tenantAId))
        .limit(1);
      if (!facA) {
        throw new Error('Test setup error: Seeded facility not found in database');
      }
      facilityAId = facA.id;
    });
  });

  it('should commit all operations within a successful tenant transaction', async () => {
    const testRecNum = `TX-REC-${Date.now()}`;

    const createdRecord = await withTenantTransaction(tenantAId, async (tx) => {
      const [inserted] = await tx
        .insert(patientRecords)
        .values({
          tenantId: tenantAId,
          facilityId: facilityAId,
          recordNumber: testRecNum,
          patientAlias: 'SYNTH-TX-SUCCESS',
          notes: 'Transaction test initial note',
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to insert test patient record');
      }

      // Record a workflow state transition in the same transaction
      await tx.insert(workflowStateTransitions).values({
        tenantId: tenantAId,
        entityType: 'CLINICAL_NOTE',
        entityId: inserted.id,
        fromState: 'DRAFT',
        toState: 'FINALIZED',
        version: 1,
        trigger: 'SUBMIT',
        reason: 'Initial consultation note finalized',
      });

      return inserted;
    });

    expect(createdRecord).toBeDefined();
    expect(createdRecord?.recordNumber).toBe(testRecNum);

    // Verify record is committed and readable in subsequent query
    const verified = await withTenantContext(tenantAId, async (tx) => {
      return await tx
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.recordNumber, testRecNum));
    });

    expect(verified.length).toBe(1);
    expect(verified[0]?.patientAlias).toBe('SYNTH-TX-SUCCESS');

    // Verify state transition was committed
    const transitions = await withTenantContext(tenantAId, async (tx) => {
      return await tx
        .select()
        .from(workflowStateTransitions)
        .where(eq(workflowStateTransitions.entityId, createdRecord!.id));
    });

    expect(transitions.length).toBe(1);
    expect(transitions[0]?.toState).toBe('FINALIZED');
    expect(transitions[0]?.version).toBe(1);
  });

  it('should completely roll back all writes if an error occurs within the transaction', async () => {
    const rollbackRecNum = `TX-ROLLBACK-${Date.now()}`;

    await expect(
      withTenantTransaction(tenantAId, async (tx) => {
        await tx.insert(patientRecords).values({
          tenantId: tenantAId,
          facilityId: facilityAId,
          recordNumber: rollbackRecNum,
          patientAlias: 'SYNTH-SHOULD-ROLLBACK',
          notes: 'This note must never exist in the database',
        });

        // Deliberately trigger an error
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }),
    ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

    // Verify record was rolled back
    const search = await withTenantContext(tenantAId, async (tx) => {
      return await tx
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.recordNumber, rollbackRecNum));
    });

    expect(search.length).toBe(0);
  });

  it('should enforce PostgreSQL Row-Level Security on new foundational tables', async () => {
    const testBlindIndex = `bindex-${randomUUID()}`;

    // 1. Insert patient identifier inside Tenant A context
    await withTenantTransaction(tenantAId, async (tx) => {
      await tx.insert(patientIdentifiers).values({
        tenantId: tenantAId,
        facilityId: facilityAId,
        system: 'KENYA_NATIONAL_ID',
        valueEncrypted: 'enc_ciphertext_sample',
        valueBlindIndex: testBlindIndex,
        valueMasked: '******1234',
        status: 'ACTIVE',
        isPrimary: true,
        patientAlias: 'SYNTH-RLS-TEST-PT',
      });
    });

    // 2. Query inside Tenant A: should return 1 row
    const resultTenantA = await withTenantContext(tenantAId, async (tx) => {
      return await tx
        .select()
        .from(patientIdentifiers)
        .where(eq(patientIdentifiers.valueBlindIndex, testBlindIndex));
    });
    expect(resultTenantA.length).toBe(1);
    expect(resultTenantA[0]?.valueMasked).toBe('******1234');

    // 3. Query inside Tenant B: should return 0 rows (hard RLS boundary)
    const resultTenantB = await withTenantContext(tenantBId, async (tx) => {
      return await tx
        .select()
        .from(patientIdentifiers)
        .where(eq(patientIdentifiers.valueBlindIndex, testBlindIndex));
    });
    expect(resultTenantB.length).toBe(0);

    // 4. Query with super-admin context: can inspect across tenants
    const resultSuperAdmin = await withSuperAdminContext(async (tx) => {
      return await tx
        .select()
        .from(patientIdentifiers)
        .where(eq(patientIdentifiers.valueBlindIndex, testBlindIndex));
    });
    expect(resultSuperAdmin.length).toBe(1);
  });
});
