import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RegistryType,
  RegistrySyncStatus,
  AuditEventType,
  encryptField,
  decryptField,
} from '@afyapoa/domain-core';
import {
  createIntegrationClients,
} from '@afyapoa/integration-adapters';
import { config } from '@afyapoa/config';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ResilienceService } from './resilience.service.js';
import {
  registrySyncRecords,
  patients,
  facilities,
  practitionerProfiles,
} from '@afyapoa/database';
import { eq, and, lte, or } from 'drizzle-orm';
import { createHash } from 'crypto';

export interface SyncProvenanceMetadata {
  sourceSystem: string;
  remoteEndpoint: string;
  syncedByUserId?: string;
  syncedAt: string;
  payloadDigest: string;
  version: string;
  isSynthetic?: boolean;
}

export interface SyncResult<T = unknown> {
  syncStatus: RegistrySyncStatus;
  recordKey: string;
  version: string;
  isFresh: boolean;
  fromCache: boolean;
  provenance: SyncProvenanceMetadata;
  data: T;
  warnings?: string[];
}

@Injectable()
export class RegistrySyncService {
  private readonly clients = createIntegrationClients(config.INTEGRATION_MODE);

  getIntegrationClients() {
    return this.clients;
  }

  // Freshness TTLs per Kenyan DHA Enterprise Standards
  private readonly ttlMap: Record<RegistryType, number> = {
    [RegistryType.CLIENT_REGISTRY]: 6 * 3600, // 6 hours for Client Registry
    [RegistryType.FACILITY_REGISTRY]: 24 * 3600, // 24 hours for KMFL
    [RegistryType.HEALTH_WORKER_REGISTRY]: 12 * 3600, // 12 hours for HWR
    [RegistryType.TERMINOLOGY_CATALOGUE]: 7 * 24 * 3600, // 7 days for KEML / ICD-11 / LOINC
  };

  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(ResilienceService)
    private readonly resilienceService: ResilienceService,
  ) {}

  // ===========================================================================
  // 1. RISK GATING: OFFLINE HANDLING CONTROLS
  // ===========================================================================

  /**
   * Prohibits queuing operations that require live, real-time external authorization
   * (e.g. SHA claim submission, live pre-authorization, biometric consent override).
   * Offline queuing of these high-risk financial/clinical operations is strictly prohibited.
   */
  assertPermittedOfflineOperation(operationType: string): void {
    const prohibitedOfflineOperations = [
      'SHA_CLAIM_SUBMIT',
      'SHA_PREAUTH_REQUEST',
      'SHA_BENEFIT_OVERRIDE',
      'BIOMETRIC_CONSENT_VERIFY',
      'KRA_ETIMS_FISCAL_SIGN',
    ];

    if (prohibitedOfflineOperations.includes(operationType)) {
      throw new ForbiddenException(
        `[OFFLINE_RISK_GUARD] Operation '${operationType}' requires live online external authorization. Queuing this operation offline violates DHA/SHA regulatory rules and creates unacceptable financial or clinical liability.`,
      );
    }
  }

  // ===========================================================================
  // 2. CLIENT REGISTRY (CR / MPI) SYNCHRONIZATION
  // ===========================================================================

  async syncClientRegistry(
    tenantId: string,
    params: {
      patientId?: string;
      nationalId: string;
      facilityCode?: string;
      forceRefresh?: boolean;
    },
    userId?: string,
  ): Promise<SyncResult> {
    const { nationalId, facilityCode = config.SHA_FACILITY_CODE, forceRefresh = false } = params;
    const registryType = RegistryType.CLIENT_REGISTRY;
    const ttlSeconds = this.ttlMap[registryType];

    // Check circuit breaker
    if (!this.resilienceService.canExecute(registryType)) {
      throw new ServiceUnavailableException(
        `DHA Client Registry circuit breaker is OPEN. Upstream service is failing or undergoing recovery.`,
      );
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Check existing cache in registrySyncRecords
      const [existingSync] = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            eq(registrySyncRecords.recordKey, nationalId),
          ),
        );

      const now = new Date();
      const isCacheFresh =
        existingSync &&
        existingSync.expiresAt &&
        existingSync.expiresAt > now &&
        existingSync.syncStatus === RegistrySyncStatus.SYNCED;

      if (isCacheFresh && !forceRefresh && existingSync.cachedDataEncrypted) {
        try {
          const decryptedData = JSON.parse(decryptField(existingSync.cachedDataEncrypted));
          const provenance: SyncProvenanceMetadata = existingSync.sourceProvenance
            ? JSON.parse(existingSync.sourceProvenance)
            : {
                sourceSystem: 'DHA_CR',
                remoteEndpoint: config.DHA_HIE_BASE_URL,
                syncedAt: existingSync.lastSyncedAt?.toISOString() || now.toISOString(),
                payloadDigest: 'cached',
                version: existingSync.version,
              };

          return {
            syncStatus: RegistrySyncStatus.SYNCED,
            recordKey: nationalId,
            version: existingSync.version,
            isFresh: true,
            fromCache: true,
            provenance,
            data: decryptedData,
          };
        } catch {
          // If decryption fails, continue to remote query
        }
      }

      // 2. Remote query to DHA Client Registry
      const startTime = Date.now();
      const lookupResult = await this.clients.dhaHie.lookupClient(
        'KENYA_NATIONAL_ID',
        nationalId,
        facilityCode,
      );
      const durationMs = Date.now() - startTime;

      if (lookupResult.isFailure()) {
        const error = lookupResult.getError();
        await this.resilienceService.recordFailure(registryType, error, tenantId);

        // Record failure in sync record
        await this.upsertSyncRecord(db, {
          tenantId,
          registryType,
          recordKey: nationalId,
          syncStatus: RegistrySyncStatus.FAILED,
          lastError: error.message,
          lastSyncedAt: now,
          ttlSeconds,
        });

        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.REGISTRY_SYNC_FAILED,
          resource: 'ClientRegistry',
          resourceId: nationalId,
          details: JSON.stringify({ error: error.message, durationMs }),
        });

        throw error;
      }

      await this.resilienceService.recordSuccess(registryType, durationMs, tenantId);
      const remotePatient = lookupResult.getValue();

      // 3. OFFLINE / UNINDEXED SAFETY RULE:
      // "Never allow queued data to appear externally verified before the verification has actually succeeded."
      const isVerified = remotePatient.status === 'VERIFIED';
      const syncStatus: RegistrySyncStatus = isVerified
        ? RegistrySyncStatus.SYNCED
        : RegistrySyncStatus.UNVERIFIED_OFFLINE;

      const payloadString = JSON.stringify(remotePatient);
      const payloadDigest = `sha256:${createHash('sha256').update(payloadString).digest('hex')}`;
      const newVersion = existingSync ? String(Number(existingSync.version) + 1) : '1';

      const provenance: SyncProvenanceMetadata = {
        sourceSystem: 'DHA_CR',
        remoteEndpoint: `${config.DHA_HIE_BASE_URL}/client-registry`,
        syncedByUserId: userId,
        syncedAt: now.toISOString(),
        payloadDigest,
        version: newVersion,
        isSynthetic: remotePatient.isSynthetic,
      };

      // 4. Update or link Patient table
      if (params.patientId) {
        await db
          .update(patients)
          .set({
            dhaCrid: isVerified ? remotePatient.crId : null,
            upi: isVerified ? remotePatient.upi : null,
            shaNumber: isVerified && remotePatient.shaNumber ? remotePatient.shaNumber : undefined,
            identityStatus: isVerified ? 'VERIFIED_EXTERNAL' : 'PENDING_VERIFICATION',
            updatedAt: now,
          })
          .where(and(eq(patients.tenantId, tenantId), eq(patients.id, params.patientId)));
      }

      // 5. Persist Sync Record
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await this.upsertSyncRecord(db, {
        tenantId,
        registryType,
        recordKey: nationalId,
        internalEntityId: params.patientId,
        externalId: isVerified ? remotePatient.crId : undefined,
        syncStatus,
        version: newVersion,
        freshnessTtlSeconds: ttlSeconds,
        lastSyncedAt: now,
        expiresAt,
        sourceProvenance: JSON.stringify(provenance),
        cachedDataEncrypted: encryptField(payloadString),
        lastError: null,
        isOfflineCreated: !isVerified,
      });

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.REGISTRY_SYNC_COMPLETED,
        resource: 'ClientRegistry',
        resourceId: nationalId,
        details: JSON.stringify({
          syncStatus,
          isVerified,
          crId: isVerified ? remotePatient.crId : null,
          version: newVersion,
          durationMs,
        }),
      });

      return {
        syncStatus,
        recordKey: nationalId,
        version: newVersion,
        isFresh: true,
        fromCache: false,
        provenance,
        data: remotePatient,
        warnings: !isVerified
          ? ['Patient is unindexed in DHA Client Registry. Kept in UNVERIFIED_OFFLINE status until indexed.']
          : undefined,
      };
    });
  }

  // ===========================================================================
  // 3. FACILITY REGISTRY (KMFL) SYNCHRONIZATION
  // ===========================================================================

  async syncFacilityRegistry(
    tenantId: string,
    kmflCode: string,
    forceRefresh = false,
    userId?: string,
  ): Promise<SyncResult> {
    const registryType = RegistryType.FACILITY_REGISTRY;
    const ttlSeconds = this.ttlMap[registryType];

    if (!this.resilienceService.canExecute(registryType)) {
      throw new ServiceUnavailableException('DHA Facility Registry circuit breaker is OPEN.');
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const now = new Date();
      const [existingSync] = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            eq(registrySyncRecords.recordKey, kmflCode),
          ),
        );

      const isCacheFresh =
        existingSync &&
        existingSync.expiresAt &&
        existingSync.expiresAt > now &&
        existingSync.syncStatus === RegistrySyncStatus.SYNCED;

      if (isCacheFresh && !forceRefresh && existingSync.cachedDataEncrypted) {
        const decrypted = JSON.parse(decryptField(existingSync.cachedDataEncrypted));
        const provenance = JSON.parse(existingSync.sourceProvenance || '{}');
        return {
          syncStatus: RegistrySyncStatus.SYNCED,
          recordKey: kmflCode,
          version: existingSync.version,
          isFresh: true,
          fromCache: true,
          provenance,
          data: decrypted,
        };
      }

      const startTime = Date.now();
      const res = await this.clients.dhaHie.verifyFacilityByKmfl(kmflCode);
      const durationMs = Date.now() - startTime;

      if (res.isFailure()) {
        const err = res.getError();
        await this.resilienceService.recordFailure(registryType, err, tenantId);
        throw err;
      }

      await this.resilienceService.recordSuccess(registryType, durationMs, tenantId);
      const facData = res.getValue();

      // Safe handling of changed or retired facilities:
      // If facility is closed or inactive, mark as RETIRED without breaking historical records
      const isRetired = facData.active === false;
      const syncStatus = isRetired ? RegistrySyncStatus.RETIRED : RegistrySyncStatus.SYNCED;
      const newVersion = existingSync ? String(Number(existingSync.version) + 1) : '1';

      if (isRetired) {
        // Soft-deactivate local facility record if present
        await db
          .update(facilities)
          .set({ active: false, updatedAt: now })
          .where(and(eq(facilities.tenantId, tenantId), eq(facilities.kmflCode, kmflCode)));

        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.REGISTRY_RECORD_RETIRED,
          resource: 'FacilityRegistry',
          resourceId: kmflCode,
          details: JSON.stringify({ reason: 'Facility closed or retired in national Master Facility List' }),
        });
      }

      const payloadString = JSON.stringify(facData);
      const provenance: SyncProvenanceMetadata = {
        sourceSystem: 'DHA_KMFL',
        remoteEndpoint: `${config.DHA_HIE_BASE_URL}/facilities`,
        syncedByUserId: userId,
        syncedAt: now.toISOString(),
        payloadDigest: `sha256:${createHash('sha256').update(payloadString).digest('hex')}`,
        version: newVersion,
        isSynthetic: facData.isSynthetic,
      };

      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await this.upsertSyncRecord(db, {
        tenantId,
        registryType,
        recordKey: kmflCode,
        externalId: kmflCode,
        syncStatus,
        version: newVersion,
        freshnessTtlSeconds: ttlSeconds,
        lastSyncedAt: now,
        expiresAt,
        sourceProvenance: JSON.stringify(provenance),
        cachedDataEncrypted: encryptField(payloadString),
        retiredAt: isRetired ? now : null,
        retiredReason: isRetired ? 'Facility closed or revoked in KMFL' : null,
      });

      return {
        syncStatus,
        recordKey: kmflCode,
        version: newVersion,
        isFresh: true,
        fromCache: false,
        provenance,
        data: facData,
        warnings: isRetired ? ['Facility is marked INACTIVE/RETIRED in Master Facility List'] : undefined,
      };
    });
  }

  // ===========================================================================
  // 4. HEALTH WORKER REGISTRY (HWR) SYNCHRONIZATION
  // ===========================================================================

  async syncHealthWorkerRegistry(
    tenantId: string,
    puid: string,
    forceRefresh = false,
    userId?: string,
  ): Promise<SyncResult> {
    const registryType = RegistryType.HEALTH_WORKER_REGISTRY;
    const ttlSeconds = this.ttlMap[registryType];

    if (!this.resilienceService.canExecute(registryType)) {
      throw new ServiceUnavailableException('DHA Health Worker Registry circuit breaker is OPEN.');
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const now = new Date();
      const [existingSync] = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            eq(registrySyncRecords.recordKey, puid),
          ),
        );

      const isCacheFresh =
        existingSync &&
        existingSync.expiresAt &&
        existingSync.expiresAt > now &&
        existingSync.syncStatus === RegistrySyncStatus.SYNCED;

      if (isCacheFresh && !forceRefresh && existingSync.cachedDataEncrypted) {
        const decrypted = JSON.parse(decryptField(existingSync.cachedDataEncrypted));
        const provenance = JSON.parse(existingSync.sourceProvenance || '{}');
        return {
          syncStatus: RegistrySyncStatus.SYNCED,
          recordKey: puid,
          version: existingSync.version,
          isFresh: true,
          fromCache: true,
          provenance,
          data: decrypted,
        };
      }

      const startTime = Date.now();
      const res = await this.clients.dhaHie.verifyHealthWorkerByPuid(puid);
      const durationMs = Date.now() - startTime;

      if (res.isFailure()) {
        const err = res.getError();
        await this.resilienceService.recordFailure(registryType, err, tenantId);
        throw err;
      }

      await this.resilienceService.recordSuccess(registryType, durationMs, tenantId);
      const workerData = res.getValue();

      // Safe handling of changed or retired practitioners:
      // If license is EXPIRED or SUSPENDED, update practitioner profile license status
      // without destroying historical clinical notes or orders signed while active
      const isRetired = workerData.licenseStatus !== 'ACTIVE';
      const syncStatus = isRetired ? RegistrySyncStatus.RETIRED : RegistrySyncStatus.SYNCED;
      const newVersion = existingSync ? String(Number(existingSync.version) + 1) : '1';

      if (isRetired) {
        await db
          .update(practitionerProfiles)
          .set({
            licenseStatus: workerData.licenseStatus,
            updatedAt: now,
          })
          .where(and(eq(practitionerProfiles.tenantId, tenantId), eq(practitionerProfiles.puid, puid)));

        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.REGISTRY_RECORD_RETIRED,
          resource: 'HealthWorkerRegistry',
          resourceId: puid,
          details: JSON.stringify({
            licenseStatus: workerData.licenseStatus,
            reason: `Practitioner license is ${workerData.licenseStatus} in professional council registry`,
          }),
        });
      }

      const payloadString = JSON.stringify(workerData);
      const provenance: SyncProvenanceMetadata = {
        sourceSystem: 'DHA_HWR',
        remoteEndpoint: `${config.DHA_HIE_BASE_URL}/health-workers`,
        syncedByUserId: userId,
        syncedAt: now.toISOString(),
        payloadDigest: `sha256:${createHash('sha256').update(payloadString).digest('hex')}`,
        version: newVersion,
        isSynthetic: workerData.isSynthetic,
      };

      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await this.upsertSyncRecord(db, {
        tenantId,
        registryType,
        recordKey: puid,
        externalId: puid,
        syncStatus,
        version: newVersion,
        freshnessTtlSeconds: ttlSeconds,
        lastSyncedAt: now,
        expiresAt,
        sourceProvenance: JSON.stringify(provenance),
        cachedDataEncrypted: encryptField(payloadString),
        retiredAt: isRetired ? now : null,
        retiredReason: isRetired ? `License status: ${workerData.licenseStatus}` : null,
      });

      return {
        syncStatus,
        recordKey: puid,
        version: newVersion,
        isFresh: true,
        fromCache: false,
        provenance,
        data: workerData,
        warnings: isRetired ? [`Practitioner license is ${workerData.licenseStatus} in HWR`] : undefined,
      };
    });
  }

  // ===========================================================================
  // 5. TERMINOLOGY & PRODUCT CATALOGUE (KEML / ICD-11 / LOINC) SYNCHRONIZATION
  // ===========================================================================

  async syncTerminologyConcept(
    tenantId: string,
    system: string,
    code: string,
    forceRefresh = false,
    userId?: string,
  ): Promise<SyncResult> {
    const registryType = RegistryType.TERMINOLOGY_CATALOGUE;
    const ttlSeconds = this.ttlMap[registryType];
    const recordKey = `${system}:${code}`;

    if (!this.resilienceService.canExecute(registryType)) {
      throw new ServiceUnavailableException('DHA Terminology Service circuit breaker is OPEN.');
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const now = new Date();
      const [existingSync] = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            eq(registrySyncRecords.recordKey, recordKey),
          ),
        );

      const isCacheFresh =
        existingSync &&
        existingSync.expiresAt &&
        existingSync.expiresAt > now &&
        existingSync.syncStatus === RegistrySyncStatus.SYNCED;

      if (isCacheFresh && !forceRefresh && existingSync.cachedDataEncrypted) {
        const decrypted = JSON.parse(decryptField(existingSync.cachedDataEncrypted));
        const provenance = JSON.parse(existingSync.sourceProvenance || '{}');
        return {
          syncStatus: RegistrySyncStatus.SYNCED,
          recordKey,
          version: existingSync.version,
          isFresh: true,
          fromCache: true,
          provenance,
          data: decrypted,
        };
      }

      const startTime = Date.now();
      const res = await this.clients.dhaHie.validateConcept(system, code);
      const durationMs = Date.now() - startTime;

      if (res.isFailure()) {
        const err = res.getError();
        await this.resilienceService.recordFailure(registryType, err, tenantId);
        throw err;
      }

      await this.resilienceService.recordSuccess(registryType, durationMs, tenantId);
      const conceptData = res.getValue();

      const isRetired = conceptData.deprecated === true;
      const syncStatus = isRetired ? RegistrySyncStatus.RETIRED : RegistrySyncStatus.SYNCED;
      const newVersion = existingSync ? String(Number(existingSync.version) + 1) : '1';

      const payloadString = JSON.stringify(conceptData);
      const provenance: SyncProvenanceMetadata = {
        sourceSystem: 'DHA_TS',
        remoteEndpoint: `${config.DHA_HIE_BASE_URL}/terminology`,
        syncedByUserId: userId,
        syncedAt: now.toISOString(),
        payloadDigest: `sha256:${createHash('sha256').update(payloadString).digest('hex')}`,
        version: newVersion,
      };

      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await this.upsertSyncRecord(db, {
        tenantId,
        registryType,
        recordKey,
        externalId: code,
        syncStatus,
        version: newVersion,
        freshnessTtlSeconds: ttlSeconds,
        lastSyncedAt: now,
        expiresAt,
        sourceProvenance: JSON.stringify(provenance),
        cachedDataEncrypted: encryptField(payloadString),
        retiredAt: isRetired ? now : null,
        retiredReason: isRetired ? 'Concept is deprecated in terminology system' : null,
      });

      return {
        syncStatus,
        recordKey,
        version: newVersion,
        isFresh: true,
        fromCache: false,
        provenance,
        data: conceptData,
        warnings: isRetired ? [`Concept '${code}' is deprecated in system '${system}'`] : undefined,
      };
    });
  }

  // ===========================================================================
  // 6. CACHE INVALIDATION & RECONCILIATION
  // ===========================================================================

  async invalidateCache(tenantId: string, registryType: RegistryType, recordKey: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      if (recordKey === '*') {
        // Invalidate all for this registry
        await db
          .update(registrySyncRecords)
          .set({ expiresAt: new Date(0), syncStatus: RegistrySyncStatus.STALE, updatedAt: new Date() })
          .where(and(eq(registrySyncRecords.tenantId, tenantId), eq(registrySyncRecords.registryType, registryType)));
      } else {
        await db
          .update(registrySyncRecords)
          .set({ expiresAt: new Date(0), syncStatus: RegistrySyncStatus.STALE, updatedAt: new Date() })
          .where(
            and(
              eq(registrySyncRecords.tenantId, tenantId),
              eq(registrySyncRecords.registryType, registryType),
              eq(registrySyncRecords.recordKey, recordKey),
            ),
          );
      }
      return { invalidated: true, registryType, recordKey };
    });
  }

  async reconcileRegistry(
    tenantId: string,
    registryType: RegistryType,
    dryRun = false,
    userId?: string,
  ): Promise<{
    dryRun: boolean;
    scanned: number;
    staleCount: number;
    reconciledCount: number;
    items: Array<{ recordKey: string; action: string; status: string }>;
  }> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const now = new Date();
      // Find stale or expired records
      const staleRecords = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            or(
              lte(registrySyncRecords.expiresAt, now),
              eq(registrySyncRecords.syncStatus, RegistrySyncStatus.STALE),
              eq(registrySyncRecords.syncStatus, RegistrySyncStatus.FAILED),
            ),
          ),
        );

      const items: Array<{ recordKey: string; action: string; status: string }> = [];
      let reconciledCount = 0;

      for (const rec of staleRecords) {
        if (dryRun) {
          items.push({
            recordKey: rec.recordKey,
            action: 'WOULD_RESYNC',
            status: rec.syncStatus,
          });
        } else {
          try {
            if (registryType === RegistryType.CLIENT_REGISTRY) {
              await this.syncClientRegistry(
                tenantId,
                { nationalId: rec.recordKey, forceRefresh: true },
                userId,
              );
            } else if (registryType === RegistryType.FACILITY_REGISTRY) {
              await this.syncFacilityRegistry(tenantId, rec.recordKey, true, userId);
            } else if (registryType === RegistryType.HEALTH_WORKER_REGISTRY) {
              await this.syncHealthWorkerRegistry(tenantId, rec.recordKey, true, userId);
            }
            reconciledCount++;
            items.push({
              recordKey: rec.recordKey,
              action: 'RESYNCED_SUCCESSFULLY',
              status: RegistrySyncStatus.SYNCED,
            });
          } catch (err: any) {
            items.push({
              recordKey: rec.recordKey,
              action: 'RESYNC_FAILED',
              status: err.message,
            });
          }
        }
      }

      if (!dryRun && reconciledCount > 0) {
        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.REGISTRY_RECORD_RECONCILED,
          resource: 'RegistryReconciliation',
          resourceId: registryType,
          details: JSON.stringify({ scanned: staleRecords.length, reconciledCount }),
        });
      }

      return {
        dryRun,
        scanned: staleRecords.length,
        staleCount: staleRecords.length,
        reconciledCount,
        items,
      };
    });
  }

  // ===========================================================================
  // 7. RECORD STATUS LOOKUP
  // ===========================================================================

  async getRecordSyncStatus(tenantId: string, registryType: RegistryType, recordKey: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [rec] = await db
        .select()
        .from(registrySyncRecords)
        .where(
          and(
            eq(registrySyncRecords.tenantId, tenantId),
            eq(registrySyncRecords.registryType, registryType),
            eq(registrySyncRecords.recordKey, recordKey),
          ),
        );

      if (!rec) {
        throw new NotFoundException(
          `Sync record not found for registry '${registryType}' with key '${recordKey}'`,
        );
      }

      const now = new Date();
      const isFresh = rec.expiresAt ? rec.expiresAt > now : false;

      return {
        id: rec.id,
        registryType: rec.registryType,
        recordKey: rec.recordKey,
        syncStatus: rec.syncStatus,
        version: rec.version,
        isFresh,
        isOfflineCreated: rec.isOfflineCreated,
        lastSyncedAt: rec.lastSyncedAt,
        expiresAt: rec.expiresAt,
        lastError: rec.lastError,
        retiredAt: rec.retiredAt,
        retiredReason: rec.retiredReason,
        provenance: rec.sourceProvenance ? JSON.parse(rec.sourceProvenance) : null,
      };
    });
  }

  // ===========================================================================
  // PRIVATE HELPER: UPSERT SYNC RECORD
  // ===========================================================================

  private async upsertSyncRecord(db: any, values: any) {
    const [existing] = await db
      .select({ id: registrySyncRecords.id })
      .from(registrySyncRecords)
      .where(
        and(
          eq(registrySyncRecords.tenantId, values.tenantId),
          eq(registrySyncRecords.registryType, values.registryType),
          eq(registrySyncRecords.recordKey, values.recordKey),
        ),
      );

    if (existing) {
      await db
        .update(registrySyncRecords)
        .set({
          ...values,
          updatedAt: new Date(),
        })
        .where(eq(registrySyncRecords.id, existing.id));
    } else {
      await db.insert(registrySyncRecords).values(values);
    }
  }
}
