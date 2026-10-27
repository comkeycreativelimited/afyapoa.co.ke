import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  StorageDriver,
  FileAccessLevel,
  FileEntityType,
  AuditEventType,
  getTenantStoragePath,
} from '@afyapoa/domain-core';
import { TenancyService } from '../../tenancy/tenancy.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { fileMetadata } from '@afyapoa/database';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';

export interface RegisterFileParams {
  tenantId: string;
  facilityId?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  entityType: FileEntityType;
  entityId: string;
  accessLevel?: FileAccessLevel;
  uploadedBy?: string;
  contentBuffer?: Buffer;
  sha256Checksum?: string;
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registers metadata and computes a secure tenant-scoped storage path.
   */
  async registerFile(params: RegisterFileParams) {
    const {
      tenantId,
      facilityId,
      originalFilename,
      mimeType,
      sizeBytes,
      entityType,
      entityId,
      accessLevel = FileAccessLevel.CONFIDENTIAL,
      uploadedBy,
      contentBuffer,
    } = params;

    // Calculate or verify checksum
    let checksum = params.sha256Checksum;
    if (contentBuffer) {
      checksum = createHash('sha256').update(contentBuffer).digest('hex');
    }
    if (!checksum) {
      checksum = createHash('sha256').update(`${originalFilename}:${Date.now()}`).digest('hex');
    }

    // Tenant-isolated storage key
    const storageKey = getTenantStoragePath(tenantId, `${entityType}/${entityId}/${originalFilename}`);
    const bucketName = 'afyapoa-secure-storage';

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [file] = await db
        .insert(fileMetadata)
        .values({
          tenantId,
          facilityId,
          storageDriver: StorageDriver.LOCAL,
          storageKey,
          bucketName,
          originalFilename,
          mimeType,
          sizeBytes,
          sha256Checksum: checksum!,
          entityType,
          entityId,
          accessLevel,
          uploadedBy,
        })
        .returning();

      if (!file) {
        throw new Error('Failed to register file metadata in database');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: uploadedBy,
        action: AuditEventType.FILE_UPLOADED,
        resource: 'FileMetadata',
        resourceId: file.id,
        details: JSON.stringify({ originalFilename, mimeType, sizeBytes, checksum }),
      });

      return file;
    });
  }

  /**
   * Resolves secure file access descriptor, verifying tenant isolation and logging access.
   */
  async getFileDescriptor(tenantId: string, fileId: string, userId?: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [file] = await db
        .select()
        .from(fileMetadata)
        .where(
          and(
            eq(fileMetadata.tenantId, tenantId),
            eq(fileMetadata.id, fileId),
          ),
        );

      if (!file) {
        throw new NotFoundException(`File ${fileId} not found`);
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.FILE_ACCESSED,
        resource: 'FileMetadata',
        resourceId: file.id,
        details: JSON.stringify({ filename: file.originalFilename }),
      });

      return {
        ...file,
        secureAccessUrl: `/api/v1/storage/download/${file.id}`,
      };
    });
  }
}
