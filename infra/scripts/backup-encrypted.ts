/**
 * infra/scripts/backup-encrypted.ts
 * AES-256-GCM Encrypted Backup Generator with SHA-256 Checksum Manifest
 * 
 * Captures database snapshot, encrypts with KMS-derived key, and generates tamper-resistant manifest.
 * Compliance: Data Protection Act 2019 Sec 41, ISO 22301 Business Continuity.
 */

import postgres from 'postgres';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '@afyapoa/config';

interface BackupManifest {
  timestamp: string;
  database: string;
  tablesCount: number;
  recordsCount: number;
  sha256Digest: string;
  algorithm: 'AES-256-GCM';
}

const tagArgIdx = process.argv.indexOf('--tag');
const tag = tagArgIdx !== -1 ? process.argv[tagArgIdx + 1] : `manual-${Date.now()}`;
const backupDir = path.resolve(process.cwd(), 'tmp/backups');

async function createEncryptedBackup() {
  console.log(`[BACKUP-ENCRYPTED] Initiating encrypted snapshot generation (Tag: ${tag})...`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const sql = postgres(config.DATABASE_URL, { max: 1 });

  try {
    // 1. Collect table list and records
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;

    console.log(`[BACKUP-ENCRYPTED] Scanning ${tables.length} database tables...`);
    let totalRecords = 0;
    const snapshotData: Record<string, any[]> = {};

    for (const t of tables) {
      const rows = await sql.unsafe(`SELECT * FROM "${t.table_name}";`);
      snapshotData[t.table_name] = rows;
      totalRecords += rows.length;
    }

    const unencryptedPayload = JSON.stringify(snapshotData);
    const sha256Digest = crypto.createHash('sha256').update(unencryptedPayload).digest('hex');

    // 2. AES-256-GCM Encryption
    const encryptionKey = crypto.createHash('sha256').update(config.KMS_PEPPER_SECRET || 'dev-pepper').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(unencryptedPayload, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Assemble Tamper-Resistant Archive Bundle
    const manifest: BackupManifest = {
      timestamp: new Date().toISOString(),
      database: config.DATABASE_NAME,
      tablesCount: tables.length,
      recordsCount: totalRecords,
      sha256Digest,
      algorithm: 'AES-256-GCM',
    };

    const archiveBundle = {
      manifest,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('base64'),
    };

    const fileName = `afyapoa-backup-${tag}-${Date.now()}.enc.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(archiveBundle, null, 2), 'utf8');

    console.log(`✅ [BACKUP-ENCRYPTED COMPLETE]`);
    console.log(`   - Archive File: ${filePath}`);
    console.log(`   - Tables Captured: ${tables.length}`);
    console.log(`   - Records Captured: ${totalRecords}`);
    console.log(`   - SHA-256 Integrity Digest: ${sha256Digest}`);
    console.log(`   - Size: ${(encrypted.length / 1024).toFixed(2)} KB (Encrypted)`);

    return filePath;
  } catch (err) {
    console.error('❌ [BACKUP-ENCRYPTED FAILED]:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createEncryptedBackup();
