import { pgTable, uuid, varchar, timestamp, text, boolean, integer, numeric, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * 1. TENANTS (Hospital Organizations)
 * The legal healthcare organization tenant entity.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull().unique(), // Unique organizational slug/code
    name: varchar('name', { length: 255 }).notNull(),
    tier: varchar('tier', { length: 32 }).default('COMMERCIAL').notNull(), // PILOT, BASIC, STANDARD, ENTERPRISE
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(), // ACTIVE, SUSPENDED, PENDING_VERIFICATION
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenants_code_idx').on(table.code),
    index('tenants_status_idx').on(table.status),
  ],
);

/**
 * 2. FACILITIES (Branches / Delivery Points under a Tenant)
 * An organization can operate one or more licensed health facilities in Kenya.
 */
export const facilities = pgTable(
  'facilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    kmflCode: varchar('kmfl_code', { length: 32 }).notNull().unique(), // e.g. FID-XX-XXXXXX-X
    name: varchar('name', { length: 255 }).notNull(),
    level: varchar('level', { length: 32 }).notNull(), // LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6
    county: varchar('county', { length: 100 }).notNull(),
    subCounty: varchar('sub_county', { length: 100 }).notNull(),
    physicalAddress: text('physical_address').notNull(),
    contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }).notNull(),
    shaContractCode: varchar('sha_contract_code', { length: 64 }),
    dhaHieEndpoint: varchar('dha_hie_endpoint', { length: 255 }),
    kraPin: varchar('kra_pin', { length: 32 }),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('facilities_tenant_idx').on(table.tenantId),
    uniqueIndex('facilities_kmfl_code_idx').on(table.kmflCode),
  ],
);

/**
 * 3. USERS
 * Staff members belonging to a specific hospital tenant.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    primaryFacilityId: uuid('primary_facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    username: varchar('username', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: varchar('role', { length: 64 }).notNull(), // SUPER_ADMIN, FACILITY_ADMIN, CLINICIAN, etc.
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaSecret: varchar('mfa_secret', { length: 128 }),
    isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
    failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_tenant_username_idx').on(table.tenantId, table.username),
    uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
    index('users_tenant_role_idx').on(table.tenantId, table.role),
  ],
);

/**
 * 4. PRACTITIONER PROFILES
 * Professional licensing and DHA Health Worker Registry (HWR) identity.
 */
export const practitionerProfiles = pgTable(
  'practitioner_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    puid: varchar('puid', { length: 64 }).notNull().unique(), // DHA Health Worker Registry ID
    cadre: varchar('cadre', { length: 64 }).notNull(), // Medical Officer, Specialist, Nurse
    regulatoryBoard: varchar('regulatory_board', { length: 32 }).notNull(), // KMPDC, NCK, PPB, COC
    licenseNumber: varchar('license_number', { length: 64 }).notNull(),
    licenseStatus: varchar('license_status', { length: 32 }).default('ACTIVE').notNull(),
    licenseExpiresAt: timestamp('license_expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('practitioners_tenant_idx').on(table.tenantId),
    uniqueIndex('practitioners_puid_idx').on(table.puid),
  ],
);

/**
 * 5. USER SESSIONS
 * State of active sessions and refresh tokens for secure session lifecycle management.
 */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 64 }),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_sessions_tenant_user_idx').on(table.tenantId, table.userId),
    index('user_sessions_expires_idx').on(table.expiresAt),
  ],
);

/**
 * 6. PASSWORD RESETS
 * Cryptographically secure tokens for self-service account recovery.
 */
export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    isUsed: boolean('is_used').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('password_resets_token_idx').on(table.tokenHash),
    index('password_resets_user_idx').on(table.userId),
  ],
);

/**
 * 7. AUDIT EVENTS
 * Immutable WORM append-only log with SHA-256 hash chaining.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id'),
    action: varchar('action', { length: 64 }).notNull(), // AUTH_LOGIN_SUCCESS, USER_ROLE_CHANGED, etc.
    resource: varchar('resource', { length: 64 }).notNull(), // User, Tenant, Session, Audit
    resourceId: varchar('resource_id', { length: 128 }),
    clientIp: varchar('client_ip', { length: 64 }),
    userAgent: text('user_agent'),
    details: text('details'),
    previousHash: varchar('previous_hash', { length: 64 }).notNull(),
    eventHash: varchar('event_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_events_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('audit_events_resource_idx').on(table.tenantId, table.resource, table.resourceId),
  ],
);

/**
 * 8. SAMPLE TENANT-OWNED RECORDS (For Cross-Tenant Isolation Testing)
 * Validates that tenant isolation policies work on business records.
 */
export const patientRecords = pgTable(
  'patient_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    recordNumber: varchar('record_number', { length: 64 }).notNull(),
    patientAlias: varchar('patient_alias', { length: 100 }).notNull(), // Synthetic pseudonym
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('patient_records_tenant_rec_idx').on(table.tenantId, table.recordNumber),
    index('patient_records_tenant_facility_idx').on(table.tenantId, table.facilityId),
  ],
);

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  facilities: many(facilities),
  users: many(users),
  sessions: many(userSessions),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [facilities.tenantId],
    references: [tenants.id],
  }),
  users: many(users),
  records: many(patientRecords),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  primaryFacility: one(facilities, {
    fields: [users.primaryFacilityId],
    references: [facilities.id],
  }),
  practitionerProfile: one(practitionerProfiles, {
    fields: [users.id],
    references: [practitionerProfiles.userId],
  }),
  sessions: many(userSessions),
}));

export const practitionerProfilesRelations = relations(practitionerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [practitionerProfiles.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [practitionerProfiles.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * 8.5. PATIENTS
 * Authoritative master patient index and demographic record for a hospital organization.
 */
export const patients = pgTable(
  'patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    primaryFacilityId: uuid('primary_facility_id')
      .references(() => facilities.id, { onDelete: 'restrict' })
      .notNull(),
    mrn: varchar('mrn', { length: 64 }).notNull(), // Unique per tenant
    firstName: varchar('first_name', { length: 100 }).notNull(),
    middleName: varchar('middle_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    dateOfBirth: varchar('date_of_birth', { length: 32 }).notNull(), // ISO YYYY-MM-DD
    isDobEstimated: boolean('is_dob_estimated').default(false).notNull(),
    gender: varchar('gender', { length: 32 }).notNull(), // MALE, FEMALE, OTHER, UNKNOWN
    bloodGroup: varchar('blood_group', { length: 16 }),
    phoneEncrypted: text('phone_encrypted'),
    phoneBlindIndex: varchar('phone_blind_index', { length: 64 }),
    phoneMasked: varchar('phone_masked', { length: 32 }),
    email: varchar('email', { length: 255 }),
    physicalAddress: text('physical_address'),
    county: varchar('county', { length: 100 }),
    subCounty: varchar('sub_county', { length: 100 }),
    ward: varchar('ward', { length: 100 }),
    village: varchar('village', { length: 100 }),
    postalCode: varchar('postal_code', { length: 32 }),
    nationality: varchar('nationality', { length: 64 }).default('KENYAN').notNull(),
    maritalStatus: varchar('marital_status', { length: 32 }),
    emergencyContact: text('emergency_contact'), // JSON string: { name, relationship, phone, alternativePhone }
    isEmergencyUnknown: boolean('is_emergency_unknown').default(false).notNull(),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(), // ACTIVE, INACTIVE, DECEASED, MERGED
    identityStatus: varchar('identity_status', { length: 32 }).default('LOCAL_ONLY').notNull(), // LOCAL_ONLY, PENDING_VERIFICATION, VERIFIED_EXTERNAL, RECONCILED
    dhaCrid: varchar('dha_crid', { length: 64 }),
    shaNumber: varchar('sha_number', { length: 64 }),
    upi: varchar('upi', { length: 64 }),
    reconciledIntoPatientId: uuid('reconciled_into_patient_id'),
    reconciliationNotes: text('reconciliation_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('patients_tenant_mrn_uniq').on(table.tenantId, table.mrn),
    index('patients_tenant_phone_bindex_idx').on(table.tenantId, table.phoneBlindIndex),
    index('patients_tenant_status_idx').on(table.tenantId, table.status),
    index('patients_tenant_identity_status_idx').on(table.tenantId, table.identityStatus),
    index('patients_tenant_crid_idx').on(table.tenantId, table.dhaCrid),
    index('patients_tenant_facility_idx').on(table.tenantId, table.primaryFacilityId),
  ],
);

/**
 * 9. PATIENT IDENTIFIERS
 * Cryptographically hashed and indexed identity markers (National ID, Passport, DHA CRID, etc.)
 */
export const patientIdentifiers = pgTable(
  'patient_identifiers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' }),
    system: varchar('system', { length: 64 }).notNull(), // KENYA_NATIONAL_ID, PASSPORT, DHA_CRID, etc.
    valueEncrypted: text('value_encrypted').notNull(),
    valueBlindIndex: varchar('value_blind_index', { length: 64 }).notNull(),
    valueMasked: varchar('value_masked', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    patientAlias: varchar('patient_alias', { length: 100 }).notNull(),
    issuingAuthority: varchar('issuing_authority', { length: 64 }),
    verificationStatus: varchar('verification_status', { length: 32 }).default('UNVERIFIED').notNull(),
    verificationMethod: varchar('verification_method', { length: 64 }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by')
      .references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('patient_identifiers_tenant_bindex_uniq').on(table.tenantId, table.system, table.valueBlindIndex),
    index('patient_identifiers_tenant_status_idx').on(table.tenantId, table.system, table.status),
    index('patient_identifiers_tenant_facility_idx').on(table.tenantId, table.facilityId),
    index('patient_identifiers_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

/**
 * 9.1 PATIENT CONSENTS
 * Statutory consent records under Kenya Data Protection Act 2019 and DHA HIE consent directives.
 */
export const patientConsents = pgTable(
  'patient_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    consentType: varchar('consent_type', { length: 64 }).notNull(), // GENERAL_DATA_PROCESSING, HIE_SHR_SHARING, etc.
    status: varchar('status', { length: 32 }).default('GRANTED').notNull(), // GRANTED, REVOKED, EXPIRED
    channel: varchar('channel', { length: 32 }).default('WRITTEN_FORM').notNull(), // WRITTEN_FORM, VERBAL_WITNESSED, SMS_OTP, BIOMETRIC
    policyVersion: varchar('policy_version', { length: 32 }).default('KE-DPA-2019-V1').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
    capturedById: uuid('captured_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    witnessName: varchar('witness_name', { length: 255 }),
    otpReference: varchar('otp_reference', { length: 64 }),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('patient_consents_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('patient_consents_tenant_type_status_idx').on(table.tenantId, table.consentType, table.status),
  ],
);

/**
 * 9.2 PATIENT RECONCILIATIONS
 * Audit trail of candidate duplicate detections, manual reviews, and safe merge reconciliations.
 */
export const patientReconciliations = pgTable(
  'patient_reconciliations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    sourcePatientId: uuid('source_patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    targetPatientId: uuid('target_patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    status: varchar('status', { length: 32 }).notNull(), // FLAGGED_DUPLICATE, CONFIRMED_MERGED, DISMISSED_FALSE_POSITIVE
    confidenceScore: varchar('confidence_score', { length: 16 }).notNull(),
    matchReasons: text('match_reasons').notNull(), // JSON string array
    actionNotes: text('action_notes'),
    reconciledById: uuid('reconciled_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('patient_reconciliations_tenant_source_idx').on(table.tenantId, table.sourcePatientId),
    index('patient_reconciliations_tenant_target_idx').on(table.tenantId, table.targetPatientId),
    index('patient_reconciliations_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 9.3 PATIENT ACCESS LOGS
 * Granular record access logging under DPA 2019 Section 41 (Data Security & Auditability).
 */
export const patientAccessLogs = pgTable(
  'patient_access_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    accessedById: uuid('accessed_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    purpose: varchar('purpose', { length: 64 }).notNull(), // CLINICAL_TREATMENT, TRIAGE, BILLING, ADMINISTRATION, AUDIT_REVIEW
    accessType: varchar('access_type', { length: 32 }).notNull(), // VIEW_DEMOGRAPHICS, VIEW_CLINICAL_HISTORY, EXPORT_RECORD
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    details: text('details'),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('patient_access_logs_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('patient_access_logs_tenant_accessed_by_idx').on(table.tenantId, table.accessedById),
    index('patient_access_logs_tenant_accessed_at_idx').on(table.tenantId, table.accessedAt),
  ],
);

/**
 * 10. INTEGRATION CONFIGURATIONS
 * Per-tenant external system endpoints and credentials (DHA, SHA, KRA, SMS).
 */
export const integrationConfigs = pgTable(
  'integration_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' }),
    systemType: varchar('system_type', { length: 64 }).notNull(), // DHA_HIE, SHA_ECCIF, KRA_ETIMS
    environment: varchar('environment', { length: 32 }).default('MOCK').notNull(), // MOCK, SANDBOX, STAGING, PRODUCTION
    endpointUrl: text('endpoint_url').notNull(),
    authType: varchar('auth_type', { length: 32 }).default('OAUTH2').notNull(), // MTLS, OAUTH2, API_KEY, BEARER
    credentialsEncrypted: text('credentials_encrypted'),
    isActive: boolean('is_active').default(true).notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
    timeoutMs: integer('timeout_ms').default(15000).notNull(),
    settings: text('settings'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('integration_configs_tenant_sys_idx').on(table.tenantId, table.systemType),
  ],
);

/**
 * 11. EXTERNAL REFERENCES
 * Bidirectional mapping between internal entity UUIDs and national registry identifiers.
 */
export const externalReferences = pgTable(
  'external_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    internalEntityType: varchar('internal_entity_type', { length: 64 }).notNull(), // PATIENT, CLAIM, INVOICE
    internalEntityId: uuid('internal_entity_id').notNull(),
    externalSystem: varchar('external_system', { length: 64 }).notNull(), // DHA_CR, SHA_ECCIF, KRA_ETIMS
    externalId: varchar('external_id', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).default('PENDING').notNull(), // SYNCED, PENDING, FAILED, OUTDATED
    syncAttempts: integer('sync_attempts').default(0).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    responseMetadata: text('response_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ext_refs_tenant_entity_sys_uniq').on(
      table.tenantId,
      table.internalEntityType,
      table.internalEntityId,
      table.externalSystem,
    ),
    index('ext_refs_tenant_external_lookup_idx').on(table.tenantId, table.externalSystem, table.externalId),
  ],
);

/**
 * 11B. REGISTRY SYNC RECORDS
 * Per-record synchronization state, version, ETag, freshness, and provenance
 * for Client Registry (CR), Facility Registry (KMFL), Health Worker Registry (HWR),
 * and Terminology / Product Catalogues (KEML, ICD-11, LOINC).
 */
export const registrySyncRecords = pgTable(
  'registry_sync_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    registryType: varchar('registry_type', { length: 64 }).notNull(), // CLIENT_REGISTRY, FACILITY_REGISTRY, HEALTH_WORKER_REGISTRY, TERMINOLOGY_CATALOGUE
    recordKey: varchar('record_key', { length: 255 }).notNull(), // e.g. national ID, KMFL code, PUID, concept code
    internalEntityId: uuid('internal_entity_id'),
    externalId: varchar('external_id', { length: 255 }),
    syncStatus: varchar('sync_status', { length: 32 }).default('PENDING').notNull(), // PENDING, SYNCED, STALE, FAILED, CONFLICT, RETIRED, UNVERIFIED_OFFLINE
    version: varchar('version', { length: 64 }).default('1').notNull(),
    etag: varchar('etag', { length: 128 }),
    freshnessTtlSeconds: integer('freshness_ttl_seconds').default(86400).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sourceProvenance: text('source_provenance'), // JSON: { sourceSystem, remoteUri, author, syncTimestamp, payloadHash }
    cachedDataEncrypted: text('cached_data_encrypted'), // AES-256-GCM encrypted snapshot
    lastError: text('last_error'),
    isOfflineCreated: boolean('is_offline_created').default(false).notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    retiredReason: text('retired_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reg_sync_tenant_type_key_uniq').on(table.tenantId, table.registryType, table.recordKey),
    index('reg_sync_tenant_status_idx').on(table.tenantId, table.syncStatus),
    index('reg_sync_tenant_expires_idx').on(table.tenantId, table.expiresAt),
    index('reg_sync_tenant_external_idx').on(table.tenantId, table.externalId),
  ],
);

/**
 * 12. JOB EXECUTIONS (Background Jobs Tracking)
 * Database-backed queue audit, tracking, and execution log.
 */
export const jobExecutions = pgTable(
  'job_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    queueName: varchar('queue_name', { length: 64 }).notNull(),
    jobType: varchar('job_type', { length: 64 }).notNull(),
    payload: text('payload').notNull(),
    status: varchar('status', { length: 32 }).default('PENDING').notNull(), // PENDING, RUNNING, COMPLETED, FAILED
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    errorDetails: text('error_details'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 128 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('job_executions_tenant_status_idx').on(table.tenantId, table.queueName, table.status),
    index('job_executions_tenant_corr_idx').on(table.tenantId, table.correlationId),
  ],
);

/**
 * 13. FILE METADATA & SECURE STORAGE
 * Metadata registry for clinical attachments, lab results, scans, and export archives.
 */
export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    storageDriver: varchar('storage_driver', { length: 32 }).default('LOCAL').notNull(),
    storageKey: text('storage_key').notNull(),
    bucketName: varchar('bucket_name', { length: 128 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256Checksum: varchar('sha256_checksum', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    accessLevel: varchar('access_level', { length: 32 }).default('CONFIDENTIAL').notNull(),
    isEncrypted: boolean('is_encrypted').default(false).notNull(),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('file_metadata_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
    index('file_metadata_tenant_checksum_idx').on(table.tenantId, table.sha256Checksum),
  ],
);

/**
 * 14. APPLICATION CONFIGURATION & FEATURE FLAGS
 * Tenant-level and facility-level dynamic parameters.
 */
export const appConfigurations = pgTable(
  'app_configurations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    configKey: varchar('config_key', { length: 128 }).notNull(),
    configValue: text('config_value').notNull(),
    valueType: varchar('value_type', { length: 32 }).default('STRING').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('app_configs_tenant_key_idx').on(table.tenantId, table.configKey),
  ],
);

/**
 * 15. WORKFLOW STATE TRANSITIONS
 * Versioned immutable audit log of status changes across clinical, financial, and inventory cycles.
 */
export const workflowStateTransitions = pgTable(
  'workflow_state_transitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(), // CLINICAL_NOTE, CPOE_ORDER, SHA_CLAIM, INVOICE
    entityId: uuid('entity_id').notNull(),
    fromState: varchar('from_state', { length: 64 }).notNull(),
    toState: varchar('to_state', { length: 64 }).notNull(),
    version: integer('version').notNull(),
    trigger: varchar('trigger', { length: 64 }).notNull(),
    actorUserId: uuid('actor_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('workflow_trans_tenant_entity_ver_idx').on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.version,
    ),
  ],
);

/**
 * 16. ENCOUNTERS
 * Outpatient and emergency encounters, queue states, and lifecycle tracking.
 */
export const encounters = pgTable(
  'encounters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'restrict' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    practitionerId: uuid('practitioner_id')
      .references(() => users.id, { onDelete: 'set null' }),
    encounterNumber: varchar('encounter_number', { length: 64 }).notNull(),
    encounterType: varchar('encounter_type', { length: 32 }).notNull(), // WALK_IN, APPOINTMENT, EMERGENCY, REFERRAL
    serviceDepartment: varchar('service_department', { length: 64 }).default('OUTPATIENT').notNull(),
    status: varchar('status', { length: 32 }).default('ARRIVED').notNull(), // PLANNED, ARRIVED, TRIAGED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED, REOPENED
    priority: varchar('priority', { length: 32 }).default('SEMI_URGENT').notNull(), // RESUSCITATION, EMERGENCY, URGENT, SEMI_URGENT, NON_URGENT
    reasonForVisit: text('reason_for_visit'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    reopenedById: uuid('reopened_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    reopeningReason: text('reopening_reason'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('encounters_tenant_number_uniq').on(table.tenantId, table.encounterNumber),
    index('encounters_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('encounters_tenant_status_idx').on(table.tenantId, table.status),
    index('encounters_tenant_dept_idx').on(table.tenantId, table.serviceDepartment, table.status),
    index('encounters_tenant_facility_idx').on(table.tenantId, table.facilityId),
  ],
);

/**
 * 17. TRIAGE VITALS
 * Nurse triage observations, physiological measurements, explicit units, and acuity score.
 */
export const triageVitals = pgTable(
  'triage_vitals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    assessedById: uuid('assessed_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    systolicBp: integer('systolic_bp'), // mmHg
    diastolicBp: integer('diastolic_bp'), // mmHg
    heartRate: integer('heart_rate'), // bpm
    respiratoryRate: integer('respiratory_rate'), // /min
    temperature: numeric('temperature', { precision: 4, scale: 1 }), // °C
    oxygenSaturation: integer('oxygen_saturation'), // %
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }), // kg
    heightCm: numeric('height_cm', { precision: 5, scale: 1 }), // cm
    bmi: numeric('bmi', { precision: 4, scale: 1 }), // kg/m^2
    bloodGlucose: numeric('blood_glucose', { precision: 4, scale: 1 }), // mmol/L
    avpuLevel: varchar('avpu_level', { length: 32 }).default('ALERT'),
    triagePriority: varchar('triage_priority', { length: 32 }).default('SEMI_URGENT').notNull(),
    triageNotes: text('triage_notes'),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('triage_vitals_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('triage_vitals_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

/**
 * 18. PATIENT ALLERGIES
 * Clinical allergy records, severity, adverse reaction history, and verification provenance.
 */
export const patientAllergies = pgTable(
  'patient_allergies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'set null' }),
    recordedById: uuid('recorded_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    allergen: varchar('allergen', { length: 255 }).notNull(),
    allergenType: varchar('allergen_type', { length: 64 }).default('MEDICATION').notNull(), // MEDICATION, FOOD, ENVIRONMENTAL, BIOLOGICAL, OTHER
    severity: varchar('severity', { length: 32 }).default('MODERATE').notNull(), // MILD, MODERATE, SEVERE, LIFE_THREATENING
    reaction: varchar('reaction', { length: 255 }),
    clinicalStatus: varchar('clinical_status', { length: 32 }).default('ACTIVE').notNull(), // ACTIVE, INACTIVE, RESOLVED
    verificationStatus: varchar('verification_status', { length: 32 }).default('CONFIRMED').notNull(), // CONFIRMED, SUSPECTED, REFUTED
    onsetAgeYears: integer('onset_age_years'),
    notes: text('notes'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('patient_allergies_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('patient_allergies_tenant_status_idx').on(table.tenantId, table.clinicalStatus),
  ],
);

/**
 * 19. CLINICAL NOTES
 * Outpatient consultation documentation, structured history, physical examination, assessment, and plan.
 */
export const clinicalNotes = pgTable(
  'clinical_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    noteType: varchar('note_type', { length: 64 }).default('CONSULTATION_NOTE').notNull(),
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(), // DRAFT, FINALIZED, AMENDED, CANCELLED
    chiefComplaint: text('chief_complaint').notNull(),
    historyOfPresentIllness: text('history_of_present_illness'),
    pastMedicalHistory: text('past_medical_history'),
    reviewOfSystems: text('review_of_systems'),
    physicalExamination: text('physical_examination'),
    assessment: text('assessment').notNull(),
    plan: text('plan').notNull(),
    entryTime: timestamp('entry_time', { withTimezone: true }).defaultNow().notNull(),
    effectiveTime: timestamp('effective_time', { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    finalizedById: uuid('finalized_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    digitalSignature: varchar('digital_signature', { length: 255 }),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('clinical_notes_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('clinical_notes_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('clinical_notes_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 20. CLINICAL NOTE AMENDMENTS
 * Immutable addendum and correction audit trail for signed/finalized clinical records.
 */
export const clinicalNoteAmendments = pgTable(
  'clinical_note_amendments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    noteId: uuid('note_id')
      .references(() => clinicalNotes.id, { onDelete: 'cascade' })
      .notNull(),
    amendedById: uuid('amended_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    reason: text('reason').notNull(),
    amendmentText: text('amendment_text').notNull(),
    amendedAt: timestamp('amended_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('clinical_note_amend_tenant_note_idx').on(table.tenantId, table.noteId),
  ],
);

/**
 * 21. TERMINOLOGY CATALOGUES
 * System catalogues for WHO ICD-11, ICD-10, LOINC, Kenya EML, WHO ATC, SNOMED CT.
 */
export const terminologyCatalogues = pgTable(
  'terminology_catalogues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    system: varchar('system', { length: 64 }).notNull(), // ICD_11_MMS, ICD_10, LOINC, SNOMED_CT, KENYA_EML, WHO_ATC
    version: varchar('version', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    authority: varchar('authority', { length: 255 }).notNull(), // WHO, Regenstrief, Ministry of Health Kenya
    releaseDate: varchar('release_date', { length: 32 }),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(), // ACTIVE, SUPERSEDED, RETIRED
    conceptCount: integer('concept_count').default(0).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('terminology_catalogues_system_version_idx').on(table.system, table.version),
  ],
);

/**
 * 22. TERMINOLOGY CONCEPTS
 * Diagnostic, laboratory, and medication concepts with codes, standardized displays, and search terms.
 */
export const terminologyConcepts = pgTable(
  'terminology_concepts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogueId: uuid('catalogue_id')
      .references(() => terminologyCatalogues.id, { onDelete: 'cascade' })
      .notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    display: text('display').notNull(),
    definition: text('definition'),
    system: varchar('system', { length: 64 }).notNull(),
    version: varchar('version', { length: 32 }).notNull(),
    effectiveStartDate: varchar('effective_start_date', { length: 32 }),
    effectiveEndDate: varchar('effective_end_date', { length: 32 }),
    isActive: boolean('is_active').default(true).notNull(),
    synonyms: jsonb('synonyms'), // string[]
    parentCode: varchar('parent_code', { length: 64 }),
    category: varchar('category', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('terminology_concepts_system_code_idx').on(table.system, table.code),
    index('terminology_concepts_catalogue_idx').on(table.catalogueId),
    index('terminology_concepts_code_idx').on(table.code),
    index('terminology_concepts_category_idx').on(table.category),
  ],
);

/**
 * 23. DIAGNOSES
 * Encounter clinical diagnoses with exact ICD-11/ICD-10 coding, verification status, and clinical provenance.
 */
export const diagnoses = pgTable(
  'diagnoses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'set null' }),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    recordedById: uuid('recorded_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    codingSystem: varchar('coding_system', { length: 64 }).default('ICD_11_MMS').notNull(),
    display: text('display').notNull(),
    diagnosisType: varchar('diagnosis_type', { length: 32 }).default('WORKING').notNull(), // WORKING, PRESUMPTIVE, CONFIRMED, DIFFERENTIAL, DISCHARGE
    clinicalStatus: varchar('clinical_status', { length: 32 }).default('ACTIVE').notNull(), // ACTIVE, RECURRENCE, RELAPSE, INACTIVE, REMISSION, RESOLVED
    verificationStatus: varchar('verification_status', { length: 32 }).default('PROVISIONAL').notNull(), // PROVISIONAL, DIFFERENTIAL, CONFIRMED, REFUTED, ENTERED_IN_ERROR
    certainty: varchar('certainty', { length: 32 }).default('SUSPECTED'), // SUSPECTED, PROBABLE, CONFIRMED
    isPrimary: boolean('is_primary').default(false).notNull(),
    onsetDate: timestamp('onset_date', { withTimezone: true }),
    notes: text('notes'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('diagnoses_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('diagnoses_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('diagnoses_tenant_code_idx').on(table.tenantId, table.code),
    index('diagnoses_tenant_status_idx').on(table.tenantId, table.clinicalStatus),
  ],
);

/**
 * 24. CLINICAL ORDERS
 * Master physician orders for medications, laboratory investigations, imaging, and procedures.
 * Separate from fulfillment, resulting observation, or pharmacy dispensing.
 */
export const clinicalOrders = pgTable(
  'clinical_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    orderingPractitionerId: uuid('ordering_practitioner_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    orderNumber: varchar('order_number', { length: 64 }).notNull(),
    orderType: varchar('order_type', { length: 64 }).notNull(), // MEDICATION_REQUEST, LAB_SERVICE_REQUEST, RADIOLOGY_SERVICE_REQUEST, PROCEDURE_REQUEST
    status: varchar('status', { length: 32 }).default('SUBMITTED').notNull(), // DRAFT, SUBMITTED, ACTIVE, AUTHORIZED, IN_PROGRESS, COMPLETED, CANCELLED, SUSPENDED, AMENDED
    priority: varchar('priority', { length: 32 }).default('ROUTINE').notNull(), // ROUTINE, URGENT, STAT, ASAP
    intent: varchar('intent', { length: 32 }).default('ORDER').notNull(), // ORDER, PROPOSAL, PLAN, ORIGINAL_ORDER
    clinicalIndication: text('clinical_indication'),
    notes: text('notes'),
    orderedAt: timestamp('ordered_at', { withTimezone: true }).defaultNow().notNull(),
    authorizedById: uuid('authorized_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    cancelledById: uuid('cancelled_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    amendmentReason: text('amendment_reason'),
    amendedById: uuid('amended_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    amendedAt: timestamp('amended_at', { withTimezone: true }),
    supersededOrderId: uuid('superseded_order_id'),
    duplicateHash: varchar('duplicate_hash', { length: 64 }),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('clinical_orders_tenant_number_idx').on(table.tenantId, table.orderNumber),
    index('clinical_orders_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('clinical_orders_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('clinical_orders_tenant_practitioner_idx').on(table.tenantId, table.orderingPractitionerId),
    index('clinical_orders_tenant_status_idx').on(table.tenantId, table.status),
    index('clinical_orders_tenant_type_idx').on(table.tenantId, table.orderType),
    index('clinical_orders_tenant_duplicate_hash_idx').on(table.tenantId, table.duplicateHash),
  ],
);

/**
 * 25. MEDICATION REQUESTS
 * Prescription specifications (dosage, route, frequency, duration, quantity, instructions).
 */
export const medicationRequests = pgTable(
  'medication_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    medicationCode: varchar('medication_code', { length: 64 }).notNull(),
    medicationName: varchar('medication_name', { length: 255 }).notNull(),
    codingSystem: varchar('coding_system', { length: 64 }).default('KENYA_EML').notNull(),
    dosage: varchar('dosage', { length: 64 }).notNull(),
    dosageUnit: varchar('dosage_unit', { length: 32 }).notNull(),
    route: varchar('route', { length: 32 }).default('ORAL').notNull(),
    frequency: varchar('frequency', { length: 32 }).default('TID').notNull(),
    durationValue: integer('duration_value').default(5).notNull(),
    durationUnit: varchar('duration_unit', { length: 32 }).default('DAYS').notNull(),
    totalQuantity: integer('total_quantity').notNull(),
    quantityUnit: varchar('quantity_unit', { length: 32 }).default('TABLETS').notNull(),
    instructions: text('instructions'),
    refillsAllowed: integer('refills_allowed').default(0).notNull(),
    isPrn: boolean('is_prn').default(false).notNull(),
    prnReason: varchar('prn_reason', { length: 255 }),
    substitutionAllowed: boolean('substitution_allowed').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('med_requests_tenant_order_idx').on(table.tenantId, table.orderId),
    index('med_requests_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('med_requests_tenant_code_idx').on(table.tenantId, table.medicationCode),
  ],
);

/**
 * 26. SERVICE REQUESTS
 * Diagnostic laboratory, radiology, and procedure orders with LOINC / MOH coding.
 */
export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    serviceCategory: varchar('service_category', { length: 64 }).default('LABORATORY').notNull(), // LABORATORY, RADIOLOGY, CARDIOLOGY, PROCEDURE, CONSULTATION
    serviceCode: varchar('service_code', { length: 64 }).notNull(),
    serviceName: varchar('service_name', { length: 255 }).notNull(),
    codingSystem: varchar('coding_system', { length: 64 }).default('LOINC').notNull(),
    specimenType: varchar('specimen_type', { length: 64 }),
    bodySite: varchar('body_site', { length: 255 }),
    clinicalNotes: text('clinical_notes'),
    urgency: varchar('urgency', { length: 32 }).default('ROUTINE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('service_requests_tenant_order_idx').on(table.tenantId, table.orderId),
    index('service_requests_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('service_requests_tenant_code_idx').on(table.tenantId, table.serviceCode),
    index('service_requests_tenant_category_idx').on(table.tenantId, table.serviceCategory),
  ],
);

/**
 * 27. LAB TEST CATALOG
 * Laboratory master test definitions mapped to LOINC/MOH Kenya codes, departments, specimen requirements, and turnaround times.
 */
export const labTestCatalog = pgTable(
  'lab_test_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' }),
    testCode: varchar('test_code', { length: 64 }).notNull(),
    codingSystem: varchar('coding_system', { length: 64 }).default('LOINC').notNull(),
    testName: varchar('test_name', { length: 255 }).notNull(),
    department: varchar('department', { length: 64 }).notNull(), // HEMATOLOGY, CLINICAL_CHEMISTRY, MICROBIOLOGY, etc.
    specimenType: varchar('specimen_type', { length: 64 }).notNull(),
    containerType: varchar('container_type', { length: 64 }).notNull(),
    targetTatMinutes: integer('target_tat_minutes').default(60).notNull(),
    methodology: varchar('methodology', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lab_test_catalog_tenant_code_idx').on(table.tenantId, table.testCode),
    index('lab_test_catalog_code_idx').on(table.testCode),
    index('lab_test_catalog_dept_idx').on(table.department),
  ],
);

/**
 * 28. LAB REFERENCE RANGES
 * Configured physiological ranges and diagnostic thresholds with provenance (source and version).
 */
export const labReferenceRanges = pgTable(
  'lab_reference_ranges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testCatalogId: uuid('test_catalog_id')
      .references(() => labTestCatalog.id, { onDelete: 'cascade' })
      .notNull(),
    gender: varchar('gender', { length: 16 }).default('ANY').notNull(), // MALE, FEMALE, ANY
    ageMinDays: integer('age_min_days').default(0).notNull(),
    ageMaxDays: integer('age_max_days').default(43800).notNull(), // ~120 years
    lowNumeric: numeric('low_numeric', { precision: 12, scale: 4 }),
    highNumeric: numeric('high_numeric', { precision: 12, scale: 4 }),
    criticalLowNumeric: numeric('critical_low_numeric', { precision: 12, scale: 4 }),
    criticalHighNumeric: numeric('critical_high_numeric', { precision: 12, scale: 4 }),
    unit: varchar('unit', { length: 64 }).notNull(),
    textualRange: varchar('textual_range', { length: 255 }),
    source: varchar('source', { length: 255 }).notNull(), // e.g. WHO Guidelines 2024, KEMRI Clinical Lab Standards 2023
    sourceVersion: varchar('source_version', { length: 64 }).notNull(),
    effectiveDate: timestamp('effective_date', { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('lab_ref_ranges_catalog_idx').on(table.testCatalogId),
    index('lab_ref_ranges_gender_idx').on(table.gender),
  ],
);

/**
 * 29. LAB SPECIMENS
 * Accessioned biological specimens with barcode tracking, collection details, and rejection/recollection linkage.
 */
export const labSpecimens = pgTable(
  'lab_specimens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    accessionNumber: varchar('accession_number', { length: 64 }).notNull(),
    barcode: varchar('barcode', { length: 128 }).notNull(),
    specimenType: varchar('specimen_type', { length: 64 }).notNull(),
    containerType: varchar('container_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).default('PENDING_COLLECTION').notNull(), // PENDING_COLLECTION, COLLECTED, IN_TRANSIT, RECEIVED_IN_LAB, PROCESSING, COMPLETED, REJECTED
    collectedById: uuid('collected_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    collectedAt: timestamp('collected_at', { withTimezone: true }),
    receivedById: uuid('received_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    rejectionReason: varchar('rejection_reason', { length: 64 }),
    rejectedById: uuid('rejected_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionNotes: text('rejection_notes'),
    recollectionRequired: boolean('recollection_required').default(false).notNull(),
    recollectionSpecimenId: uuid('recollection_specimen_id'),
    collectionSite: varchar('collection_site', { length: 128 }),
    volumeMl: numeric('volume_ml', { precision: 8, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lab_specimens_tenant_accession_idx').on(table.tenantId, table.accessionNumber),
    uniqueIndex('lab_specimens_tenant_barcode_idx').on(table.tenantId, table.barcode),
    index('lab_specimens_tenant_order_idx').on(table.tenantId, table.orderId),
    index('lab_specimens_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('lab_specimens_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 30. LAB RESULTS
 * Individual analytic test results with abnormal flags, technologist entry, and supervisor verification.
 */
export const labResults = pgTable(
  'lab_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    specimenId: uuid('specimen_id')
      .references(() => labSpecimens.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    testCatalogId: uuid('test_catalog_id')
      .references(() => labTestCatalog.id, { onDelete: 'set null' })
      .notNull(),
    testCode: varchar('test_code', { length: 64 }).notNull(),
    testName: varchar('test_name', { length: 255 }).notNull(),
    department: varchar('department', { length: 64 }).notNull(),
    numericValue: numeric('numeric_value', { precision: 12, scale: 4 }),
    textValue: text('text_value'),
    unit: varchar('unit', { length: 64 }),
    referenceRangeLow: numeric('reference_range_low', { precision: 12, scale: 4 }),
    referenceRangeHigh: numeric('reference_range_high', { precision: 12, scale: 4 }),
    referenceRangeText: varchar('reference_range_text', { length: 255 }),
    referenceSource: varchar('reference_source', { length: 255 }),
    referenceSourceVersion: varchar('reference_source_version', { length: 64 }),
    abnormalFlag: varchar('abnormal_flag', { length: 32 }).default('NORMAL').notNull(), // NORMAL, ABNORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH
    technologistId: uuid('technologist_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    enteredAt: timestamp('entered_at', { withTimezone: true }).defaultNow().notNull(),
    verifiedById: uuid('verified_by_id')
      .references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifierRole: varchar('verifier_role', { length: 64 }),
    verificationSignature: text('verification_signature'),
    status: varchar('status', { length: 32 }).default('PRELIMINARY').notNull(), // PRELIMINARY, VERIFIED, AUTHORIZED, AMENDED, CORRECTED, CANCELLED
    correctedFromId: uuid('corrected_from_id'),
    correctionReason: text('correction_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('lab_results_tenant_specimen_idx').on(table.tenantId, table.specimenId),
    index('lab_results_tenant_order_idx').on(table.tenantId, table.orderId),
    index('lab_results_tenant_catalog_idx').on(table.tenantId, table.testCatalogId),
    index('lab_results_tenant_status_idx').on(table.tenantId, table.status),
    index('lab_results_tenant_abnormal_idx').on(table.tenantId, table.abnormalFlag),
  ],
);

/**
 * 31. DIAGNOSTIC REPORTS
 * Final authorized laboratory diagnostic reports compiled for clinical encounters.
 */
export const diagnosticReports = pgTable(
  'diagnostic_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    reportNumber: varchar('report_number', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).default('PRELIMINARY').notNull(), // REGISTERED, PARTIAL, PRELIMINARY, FINAL, AMENDED, CORRECTED, CANCELLED
    title: varchar('title', { length: 255 }).notNull(),
    conclusion: text('conclusion'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    performerId: uuid('performer_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    authorizerId: uuid('authorizer_id')
      .references(() => users.id, { onDelete: 'set null' }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    authorizationSignature: text('authorization_signature'),
    amendedFromId: uuid('amended_from_id'),
    amendmentReason: text('amendment_reason'),
    resultsSummary: text('results_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('diagnostic_reports_tenant_number_idx').on(table.tenantId, table.reportNumber),
    index('diagnostic_reports_tenant_order_idx').on(table.tenantId, table.orderId),
    index('diagnostic_reports_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('diagnostic_reports_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('diagnostic_reports_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 32. LAB CONSUMABLES
 * Inventory of tubes, slides, reagents, rapid test cassettes, and consumables tracked per facility.
 */
export const labConsumables = pgTable(
  'lab_consumables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    itemCode: varchar('item_code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(), // VACUTAINER, REAGENT, RAPID_TEST_KIT, PPE, CONSUMABLE
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    reorderLevel: integer('reorder_level').default(10).notNull(),
    unitOfMeasure: varchar('unit_of_measure', { length: 32 }).notNull(),
    lotNumber: varchar('lot_number', { length: 64 }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lab_consumables_tenant_facility_code_idx').on(table.tenantId, table.facilityId, table.itemCode),
    index('lab_consumables_tenant_category_idx').on(table.tenantId, table.category),
  ],
);

/**
 * 33. LAB CONSUMABLE DEDUCTIONS
 * Stock deduction audit ledger linked to specimen collection or test analysis.
 */
export const labConsumableDeductions = pgTable(
  'lab_consumable_deductions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    consumableId: uuid('consumable_id')
      .references(() => labConsumables.id, { onDelete: 'cascade' })
      .notNull(),
    specimenId: uuid('specimen_id')
      .references(() => labSpecimens.id, { onDelete: 'set null' }),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'set null' }),
    quantityDeducted: integer('quantity_deducted').default(1).notNull(),
    reason: varchar('reason', { length: 64 }).notNull(), // SPECIMEN_COLLECTION, ANALYSIS, RECOLLECTION_WASTAGE, QUALITY_CONTROL
    deductedById: uuid('deducted_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    deductedAt: timestamp('deducted_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('lab_deductions_tenant_consumable_idx').on(table.tenantId, table.consumableId),
    index('lab_deductions_tenant_specimen_idx').on(table.tenantId, table.specimenId),
    index('lab_deductions_tenant_order_idx').on(table.tenantId, table.orderId),
  ],
);

/**
 * 34. PHARMACY PRODUCTS
 * Approved medicine and medical product catalogue (Kenya Essential Medicines List KEML / ATC).
 */
export const pharmacyProducts = pgTable(
  'pharmacy_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    itemCode: varchar('item_code', { length: 64 }).notNull(),
    genericName: varchar('generic_name', { length: 255 }).notNull(),
    brandName: varchar('brand_name', { length: 255 }),
    atcCode: varchar('atc_code', { length: 32 }),
    kemlCategory: varchar('keml_category', { length: 64 }),
    drugSchedule: varchar('drug_schedule', { length: 32 }).default('PART_1_POISON').notNull(),
    category: varchar('category', { length: 64 }).default('ORAL_SOLID').notNull(),
    form: varchar('form', { length: 64 }).notNull(),
    strength: varchar('strength', { length: 64 }).notNull(),
    strengthUnit: varchar('strength_unit', { length: 32 }).notNull(),
    dispensingUnit: varchar('dispensing_unit', { length: 32 }).default('TABLET').notNull(),
    packagingUnit: varchar('packaging_unit', { length: 32 }).default('BLISTER_PACK').notNull(),
    packagingSize: integer('packaging_size').default(1).notNull(),
    storageCondition: varchar('storage_condition', { length: 32 }).default('ROOM_TEMPERATURE').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    reorderLevel: integer('reorder_level').default(50).notNull(),
    maxStockLevel: integer('max_stock_level').default(1000),
    prescriptionRequired: boolean('prescription_required').default(true).notNull(),
    controlledSubstance: boolean('controlled_substance').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('pharmacy_products_code_idx').on(table.itemCode),
    index('pharmacy_products_generic_idx').on(table.genericName),
    index('pharmacy_products_atc_idx').on(table.atcCode),
    index('pharmacy_products_schedule_idx').on(table.drugSchedule),
    index('pharmacy_products_category_idx').on(table.category),
    index('pharmacy_products_tenant_idx').on(table.tenantId),
  ],
);

/**
 * 35. PHARMACY SUPPLIERS
 * Licensed pharmaceutical suppliers, distributors, and procurement records.
 */
export const pharmacySuppliers = pgTable(
  'pharmacy_suppliers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    supplierCode: varchar('supplier_code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    ppbLicenseNumber: varchar('ppb_license_number', { length: 128 }),
    kraPin: varchar('kra_pin', { length: 64 }),
    contactPerson: varchar('contact_person', { length: 128 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    physicalAddress: text('physical_address'),
    leadTimeDays: integer('lead_time_days').default(7).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('pharmacy_suppliers_tenant_code_idx').on(table.tenantId, table.supplierCode),
    index('pharmacy_suppliers_tenant_active_idx').on(table.tenantId, table.isActive),
  ],
);

/**
 * 36. PHARMACY BATCHES
 * Batches with manufacturing, expiry, acquisition cost, and stock on hand.
 */
export const pharmacyBatches = pgTable(
  'pharmacy_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => pharmacyProducts.id, { onDelete: 'cascade' })
      .notNull(),
    batchNumber: varchar('batch_number', { length: 64 }).notNull(),
    manufacturer: varchar('manufacturer', { length: 255 }),
    manufacturedDate: timestamp('manufactured_date', { withTimezone: true }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }).notNull(),
    quantityReceived: integer('quantity_received').default(0).notNull(),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).default('0.00').notNull(),
    sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
    storageBin: varchar('storage_bin', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('pharmacy_batches_tenant_facility_prod_batch_idx').on(
      table.tenantId,
      table.facilityId,
      table.productId,
      table.batchNumber,
    ),
    index('pharmacy_batches_tenant_facility_expiry_idx').on(table.tenantId, table.facilityId, table.expiryDate),
    index('pharmacy_batches_tenant_prod_status_idx').on(table.tenantId, table.productId, table.status),
  ],
);

/**
 * 37. PHARMACY STOCK MOVEMENTS
 * Immutable audit ledger of all inventory transactions.
 * Explicit movements rather than silent overwrites.
 */
export const pharmacyStockMovements = pgTable(
  'pharmacy_stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => pharmacyProducts.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id').references(() => pharmacyBatches.id, { onDelete: 'set null' }),
    movementType: varchar('movement_type', { length: 64 }).notNull(),
    quantity: integer('quantity').notNull(),
    quantityBefore: integer('quantity_before').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
    referenceType: varchar('reference_type', { length: 64 }),
    referenceId: uuid('reference_id'),
    supplierId: uuid('supplier_id').references(() => pharmacySuppliers.id, { onDelete: 'set null' }),
    destinationFacilityId: uuid('destination_facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    reason: varchar('reason', { length: 255 }),
    notes: text('notes'),
    performedById: uuid('performed_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    movementDate: timestamp('movement_date', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('pharmacy_movements_tenant_facility_idx').on(table.tenantId, table.facilityId),
    index('pharmacy_movements_tenant_product_idx').on(table.tenantId, table.productId),
    index('pharmacy_movements_tenant_batch_idx').on(table.tenantId, table.batchId),
    index('pharmacy_movements_tenant_type_idx').on(table.tenantId, table.movementType),
    index('pharmacy_movements_tenant_date_idx').on(table.tenantId, table.movementDate),
  ],
);

/**
 * 38. MEDICATION DISPENSES
 * Pharmacist dispensing events fulfilling medication requests.
 */
export const medicationDispenses = pgTable(
  'medication_dispenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: uuid('order_id')
      .references(() => clinicalOrders.id, { onDelete: 'cascade' })
      .notNull(),
    medicationRequestId: uuid('medication_request_id')
      .references(() => medicationRequests.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    dispenseNumber: varchar('dispense_number', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).default('PREPARATION').notNull(),
    dispenseType: varchar('dispense_type', { length: 32 }).default('FULL').notNull(),
    quantityPrescribed: integer('quantity_prescribed').notNull(),
    quantityDispensed: integer('quantity_dispensed').default(0).notNull(),
    quantityRemaining: integer('quantity_remaining').default(0).notNull(),
    daysSupply: integer('days_supply'),
    dosageInstructions: text('dosage_instructions'),
    dispenserId: uuid('dispenser_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    dispensedAt: timestamp('dispensed_at', { withTimezone: true }).defaultNow().notNull(),
    authorizedById: uuid('authorized_by_id').references(() => users.id, { onDelete: 'set null' }),
    substitutionReason: text('substitution_reason'),
    patientCounselingNotes: text('patient_counseling_notes'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('med_dispenses_tenant_number_idx').on(table.tenantId, table.dispenseNumber),
    index('med_dispenses_tenant_order_idx').on(table.tenantId, table.orderId),
    index('med_dispenses_tenant_med_req_idx').on(table.tenantId, table.medicationRequestId),
    index('med_dispenses_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('med_dispenses_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 39. MEDICATION DISPENSE ITEMS
 * Batch-level breakdown and deduction for each medication dispense.
 */
export const medicationDispenseItems = pgTable(
  'medication_dispense_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    dispenseId: uuid('dispense_id')
      .references(() => medicationDispenses.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id')
      .references(() => pharmacyBatches.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => pharmacyProducts.id, { onDelete: 'cascade' })
      .notNull(),
    quantityDispensed: integer('quantity_dispensed').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dispense_items_tenant_dispense_idx').on(table.tenantId, table.dispenseId),
    index('dispense_items_tenant_batch_idx').on(table.tenantId, table.batchId),
    index('dispense_items_tenant_product_idx').on(table.tenantId, table.productId),
  ],
);

/**
 * 40. MEDICATION ADMINISTRATIONS
 * Clinical administration events performed by nurses/practitioners at bedside.
 */
export const medicationAdministrations = pgTable(
  'medication_administrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    dispenseId: uuid('dispense_id').references(() => medicationDispenses.id, { onDelete: 'set null' }),
    medicationRequestId: uuid('medication_request_id')
      .references(() => medicationRequests.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id')
      .references(() => encounters.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    administratorId: uuid('administrator_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    administeredAt: timestamp('administered_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 32 }).default('COMPLETED').notNull(),
    doseQuantity: numeric('dose_quantity', { precision: 10, scale: 2 }).notNull(),
    doseUnit: varchar('dose_unit', { length: 32 }).notNull(),
    route: varchar('route', { length: 32 }).default('ORAL').notNull(),
    site: varchar('site', { length: 128 }),
    reasonNotAdministered: text('reason_not_administered'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('med_admin_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('med_admin_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('med_admin_tenant_med_req_idx').on(table.tenantId, table.medicationRequestId),
    index('med_admin_tenant_dispense_idx').on(table.tenantId, table.dispenseId),
    index('med_admin_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 41. BILLING SERVICE CATALOGUE (Tariffs & Service Price Lists)
 */
export const billingServiceCatalogue = pgTable(
  'billing_service_catalogue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }),
    serviceCode: varchar('service_code', { length: 64 }).notNull(),
    serviceName: varchar('service_name', { length: 255 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    department: varchar('department', { length: 64 }).notNull(),
    basePrice: numeric('base_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    taxRate: numeric('tax_rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
    taxCode: varchar('tax_code', { length: 16 }).default('E').notNull(),
    clinicalCode: varchar('clinical_code', { length: 64 }),
    clinicalCodingSystem: varchar('clinical_coding_system', { length: 64 }),
    shaCovered: boolean('sha_covered').default(false).notNull(),
    shaStandardTariff: numeric('sha_standard_tariff', { precision: 12, scale: 2 }).default('0.00').notNull(),
    preauthorizationRequired: boolean('preauthorization_required').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('billing_services_code_idx').on(table.serviceCode),
    index('billing_services_tenant_idx').on(table.tenantId),
    index('billing_services_cat_idx').on(table.category),
  ],
);

/**
 * 42. INVOICES
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    invoiceType: varchar('invoice_type', { length: 32 }).default('ORIGINAL').notNull(),
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(),
    payerType: varchar('payer_type', { length: 32 }).default('OUT_OF_POCKET').notNull(),
    shaFundType: varchar('sha_fund_type', { length: 32 }),
    shaClaimReference: varchar('sha_claim_reference', { length: 64 }),
    currency: varchar('currency', { length: 8 }).default('KES').notNull(),
    subtotalAmount: numeric('subtotal_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    shaPortionAmount: numeric('sha_portion_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    patientPortionAmount: numeric('patient_portion_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    balanceDue: numeric('balance_due', { precision: 12, scale: 2 }).default('0.00').notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    etimsStatus: varchar('etims_status', { length: 32 }).default('PENDING').notNull(),
    etimsControlCode: varchar('etims_control_code', { length: 128 }),
    etimsQrCode: text('etims_qr_code'),
    etimsSignedAt: timestamp('etims_signed_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    finalizedById: uuid('finalized_by_id').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledById: uuid('cancelled_by_id').references(() => users.id, { onDelete: 'set null' }),
    cancellationReason: text('cancellation_reason'),
    creditNoteInvoiceId: uuid('credit_note_invoice_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('invoices_tenant_number_idx').on(table.tenantId, table.invoiceNumber),
    index('invoices_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('invoices_tenant_encounter_idx').on(table.tenantId, table.encounterId),
    index('invoices_tenant_status_idx').on(table.tenantId, table.status),
    index('invoices_tenant_etims_idx').on(table.tenantId, table.etimsStatus),
  ],
);

/**
 * 43. INVOICE LINE ITEMS
 */
export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    invoiceId: uuid('invoice_id')
      .references(() => invoices.id, { onDelete: 'cascade' })
      .notNull(),
    billingServiceId: uuid('billing_service_id').references(() => billingServiceCatalogue.id, { onDelete: 'set null' }),
    sourceType: varchar('source_type', { length: 64 }).default('MANUAL').notNull(),
    sourceReferenceId: uuid('source_reference_id'),
    itemCode: varchar('item_code', { length: 64 }).notNull(),
    itemDescription: varchar('item_description', { length: 255 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).default('1.00').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
    grossAmount: numeric('gross_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    taxRate: numeric('tax_rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
    taxCode: varchar('tax_code', { length: 16 }).default('E').notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    netAmount: numeric('net_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    shaCoverageAmount: numeric('sha_coverage_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    patientPayableAmount: numeric('patient_payable_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('invoice_items_tenant_invoice_idx').on(table.tenantId, table.invoiceId),
    index('invoice_items_tenant_source_idx').on(table.tenantId, table.sourceType, table.sourceReferenceId),
  ],
);

/**
 * 44. INVOICE ADJUSTMENTS (Discounts & Waivers)
 */
export const invoiceAdjustments = pgTable(
  'invoice_adjustments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    invoiceId: uuid('invoice_id')
      .references(() => invoices.id, { onDelete: 'cascade' })
      .notNull(),
    lineItemId: uuid('line_item_id').references(() => invoiceLineItems.id, { onDelete: 'set null' }),
    adjustmentType: varchar('adjustment_type', { length: 32 }).notNull(),
    requestedAmount: numeric('requested_amount', { precision: 12, scale: 2 }).notNull(),
    approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 32 }).default('PENDING_APPROVAL').notNull(),
    requestedById: uuid('requested_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('adjustments_tenant_invoice_idx').on(table.tenantId, table.invoiceId),
    index('adjustments_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

/**
 * 45. PAYMENTS (Receipts & Financial Transactions)
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    paymentNumber: varchar('payment_number', { length: 64 }).notNull(),
    receiptNumber: varchar('receipt_number', { length: 64 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 8 }).default('KES').notNull(),
    status: varchar('status', { length: 32 }).default('COMPLETED').notNull(),
    paymentReference: varchar('payment_reference', { length: 128 }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    receivedById: uuid('received_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payments_tenant_number_idx').on(table.tenantId, table.paymentNumber),
    uniqueIndex('payments_tenant_receipt_idx').on(table.tenantId, table.receiptNumber),
    uniqueIndex('payments_tenant_idempotency_idx').on(table.tenantId, table.idempotencyKey),
    index('payments_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('payments_tenant_method_idx').on(table.tenantId, table.paymentMethod),
  ],
);

/**
 * 46. PAYMENT ALLOCATIONS
 */
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    paymentId: uuid('payment_id')
      .references(() => payments.id, { onDelete: 'cascade' })
      .notNull(),
    invoiceId: uuid('invoice_id')
      .references(() => invoices.id, { onDelete: 'cascade' })
      .notNull(),
    amountAllocated: numeric('amount_allocated', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('allocations_tenant_payment_idx').on(table.tenantId, table.paymentId),
    index('allocations_tenant_invoice_idx').on(table.tenantId, table.invoiceId),
  ],
);

/**
 * 47. PAYMENT REVERSALS (Refunds & Reversals - Immutable Financial Audit Trail)
 */
export const paymentReversals = pgTable(
  'payment_reversals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    paymentId: uuid('payment_id')
      .references(() => payments.id, { onDelete: 'cascade' })
      .notNull(),
    reversalNumber: varchar('reversal_number', { length: 64 }).notNull(),
    reversalType: varchar('reversal_type', { length: 32 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 32 }).default('APPROVED').notNull(),
    requestedById: uuid('requested_by_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    authorizedById: uuid('authorized_by_id').references(() => users.id, { onDelete: 'set null' }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    refundMethod: varchar('refund_method', { length: 32 }).default('CASH').notNull(),
    refundReference: varchar('refund_reference', { length: 128 }),
    creditNoteInvoiceId: uuid('credit_note_invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reversals_tenant_number_idx').on(table.tenantId, table.reversalNumber),
    index('reversals_tenant_payment_idx').on(table.tenantId, table.paymentId),
  ],
);

/**
 * 48. DAILY RECONCILIATIONS (Cashier Shift & Till Reconciliation)
 */
export const dailyReconciliations = pgTable(
  'daily_reconciliations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    cashierId: uuid('cashier_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    shiftNumber: varchar('shift_number', { length: 64 }).notNull(),
    shiftDate: varchar('shift_date', { length: 32 }).notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    openingFloat: numeric('opening_float', { precision: 12, scale: 2 }).default('0.00').notNull(),
    expectedCash: numeric('expected_cash', { precision: 12, scale: 2 }).default('0.00').notNull(),
    countedCash: numeric('counted_cash', { precision: 12, scale: 2 }).default('0.00').notNull(),
    cashDiscrepancy: numeric('cash_discrepancy', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalMpesa: numeric('total_mpesa', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalCard: numeric('total_card', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalBank: numeric('total_bank', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalOther: numeric('total_other', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalCollections: numeric('total_collections', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalRefunds: numeric('total_refunds', { precision: 12, scale: 2 }).default('0.00').notNull(),
    netCollections: numeric('net_collections', { precision: 12, scale: 2 }).default('0.00').notNull(),
    status: varchar('status', { length: 32 }).default('OPEN').notNull(),
    supervisorId: uuid('supervisor_id').references(() => users.id, { onDelete: 'set null' }),
    supervisorNotes: text('supervisor_notes'),
    cashierNotes: text('cashier_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reconciliations_tenant_shift_idx').on(table.tenantId, table.shiftNumber),
    index('reconciliations_tenant_cashier_idx').on(table.tenantId, table.cashierId),
    index('reconciliations_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

// Extended Relations
export const patientIdentifiersRelations = relations(patientIdentifiers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patientIdentifiers.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [patientIdentifiers.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [patientIdentifiers.patientId],
    references: [patients.id],
  }),
  verifiedByUser: one(users, {
    fields: [patientIdentifiers.verifiedBy],
    references: [users.id],
  }),
}));

export const integrationConfigsRelations = relations(integrationConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [integrationConfigs.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [integrationConfigs.facilityId],
    references: [facilities.id],
  }),
}));

export const externalReferencesRelations = relations(externalReferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [externalReferences.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [externalReferences.facilityId],
    references: [facilities.id],
  }),
}));

export const registrySyncRecordsRelations = relations(registrySyncRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [registrySyncRecords.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [registrySyncRecords.facilityId],
    references: [facilities.id],
  }),
}));

export const jobExecutionsRelations = relations(jobExecutions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [jobExecutions.tenantId],
    references: [tenants.id],
  }),
}));

export const fileMetadataRelations = relations(fileMetadata, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fileMetadata.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [fileMetadata.facilityId],
    references: [facilities.id],
  }),
  uploadedByUser: one(users, {
    fields: [fileMetadata.uploadedBy],
    references: [users.id],
  }),
}));

export const workflowStateTransitionsRelations = relations(workflowStateTransitions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workflowStateTransitions.tenantId],
    references: [tenants.id],
  }),
  actorUser: one(users, {
    fields: [workflowStateTransitions.actorUserId],
    references: [users.id],
  }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [patients.tenantId],
    references: [tenants.id],
  }),
  primaryFacility: one(facilities, {
    fields: [patients.primaryFacilityId],
    references: [facilities.id],
  }),
  identifiers: many(patientIdentifiers),
  consents: many(patientConsents),
  records: many(patientRecords),
  accessLogs: many(patientAccessLogs),
}));

export const patientConsentsRelations = relations(patientConsents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patientConsents.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [patientConsents.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [patientConsents.patientId],
    references: [patients.id],
  }),
  capturedByUser: one(users, {
    fields: [patientConsents.capturedById],
    references: [users.id],
  }),
}));

export const patientReconciliationsRelations = relations(patientReconciliations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patientReconciliations.tenantId],
    references: [tenants.id],
  }),
  sourcePatient: one(patients, {
    fields: [patientReconciliations.sourcePatientId],
    references: [patients.id],
  }),
  targetPatient: one(patients, {
    fields: [patientReconciliations.targetPatientId],
    references: [patients.id],
  }),
  reconciledByUser: one(users, {
    fields: [patientReconciliations.reconciledById],
    references: [users.id],
  }),
}));

export const patientAccessLogsRelations = relations(patientAccessLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patientAccessLogs.tenantId],
    references: [tenants.id],
  }),
  patient: one(patients, {
    fields: [patientAccessLogs.patientId],
    references: [patients.id],
  }),
  accessedByUser: one(users, {
    fields: [patientAccessLogs.accessedById],
    references: [users.id],
  }),
}));

export const encountersRelations = relations(encounters, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [encounters.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [encounters.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [encounters.patientId],
    references: [patients.id],
  }),
  practitioner: one(users, {
    fields: [encounters.practitionerId],
    references: [users.id],
  }),
  vitals: many(triageVitals),
  clinicalNotes: many(clinicalNotes),
  allergies: many(patientAllergies),
  diagnoses: many(diagnoses),
  orders: many(clinicalOrders),
}));

export const triageVitalsRelations = relations(triageVitals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [triageVitals.tenantId],
    references: [tenants.id],
  }),
  encounter: one(encounters, {
    fields: [triageVitals.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [triageVitals.patientId],
    references: [patients.id],
  }),
  assessedByUser: one(users, {
    fields: [triageVitals.assessedById],
    references: [users.id],
  }),
}));

export const patientAllergiesRelations = relations(patientAllergies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patientAllergies.tenantId],
    references: [tenants.id],
  }),
  patient: one(patients, {
    fields: [patientAllergies.patientId],
    references: [patients.id],
  }),
  encounter: one(encounters, {
    fields: [patientAllergies.encounterId],
    references: [encounters.id],
  }),
  recordedByUser: one(users, {
    fields: [patientAllergies.recordedById],
    references: [users.id],
  }),
}));

export const clinicalNotesRelations = relations(clinicalNotes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clinicalNotes.tenantId],
    references: [tenants.id],
  }),
  encounter: one(encounters, {
    fields: [clinicalNotes.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [clinicalNotes.patientId],
    references: [patients.id],
  }),
  author: one(users, {
    fields: [clinicalNotes.authorId],
    references: [users.id],
  }),
  finalizedByUser: one(users, {
    fields: [clinicalNotes.finalizedById],
    references: [users.id],
  }),
  amendments: many(clinicalNoteAmendments),
}));

export const clinicalNoteAmendmentsRelations = relations(clinicalNoteAmendments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [clinicalNoteAmendments.tenantId],
    references: [tenants.id],
  }),
  note: one(clinicalNotes, {
    fields: [clinicalNoteAmendments.noteId],
    references: [clinicalNotes.id],
  }),
  amendedByUser: one(users, {
    fields: [clinicalNoteAmendments.amendedById],
    references: [users.id],
  }),
}));

export const terminologyCataloguesRelations = relations(terminologyCatalogues, ({ many }) => ({
  concepts: many(terminologyConcepts),
}));

export const terminologyConceptsRelations = relations(terminologyConcepts, ({ one }) => ({
  catalogue: one(terminologyCatalogues, {
    fields: [terminologyConcepts.catalogueId],
    references: [terminologyCatalogues.id],
  }),
}));

export const diagnosesRelations = relations(diagnoses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [diagnoses.tenantId],
    references: [tenants.id],
  }),
  encounter: one(encounters, {
    fields: [diagnoses.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [diagnoses.patientId],
    references: [patients.id],
  }),
  recordedByUser: one(users, {
    fields: [diagnoses.recordedById],
    references: [users.id],
  }),
}));

export const clinicalOrdersRelations = relations(clinicalOrders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clinicalOrders.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [clinicalOrders.facilityId],
    references: [facilities.id],
  }),
  encounter: one(encounters, {
    fields: [clinicalOrders.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [clinicalOrders.patientId],
    references: [patients.id],
  }),
  orderingPractitioner: one(users, {
    fields: [clinicalOrders.orderingPractitionerId],
    references: [users.id],
  }),
  authorizedByUser: one(users, {
    fields: [clinicalOrders.authorizedById],
    references: [users.id],
  }),
  cancelledByUser: one(users, {
    fields: [clinicalOrders.cancelledById],
    references: [users.id],
  }),
  medicationRequests: many(medicationRequests),
  serviceRequests: many(serviceRequests),
  specimens: many(labSpecimens),
  diagnosticReports: many(diagnosticReports),
}));

export const medicationRequestsRelations = relations(medicationRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [medicationRequests.tenantId],
    references: [tenants.id],
  }),
  order: one(clinicalOrders, {
    fields: [medicationRequests.orderId],
    references: [clinicalOrders.id],
  }),
  patient: one(patients, {
    fields: [medicationRequests.patientId],
    references: [patients.id],
  }),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceRequests.tenantId],
    references: [tenants.id],
  }),
  order: one(clinicalOrders, {
    fields: [serviceRequests.orderId],
    references: [clinicalOrders.id],
  }),
  patient: one(patients, {
    fields: [serviceRequests.patientId],
    references: [patients.id],
  }),
}));

export const labTestCatalogRelations = relations(labTestCatalog, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [labTestCatalog.tenantId],
    references: [tenants.id],
  }),
  referenceRanges: many(labReferenceRanges),
  results: many(labResults),
}));

export const labReferenceRangesRelations = relations(labReferenceRanges, ({ one }) => ({
  testCatalog: one(labTestCatalog, {
    fields: [labReferenceRanges.testCatalogId],
    references: [labTestCatalog.id],
  }),
}));

export const labSpecimensRelations = relations(labSpecimens, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [labSpecimens.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [labSpecimens.facilityId],
    references: [facilities.id],
  }),
  order: one(clinicalOrders, {
    fields: [labSpecimens.orderId],
    references: [clinicalOrders.id],
  }),
  patient: one(patients, {
    fields: [labSpecimens.patientId],
    references: [patients.id],
  }),
  collectedByUser: one(users, {
    fields: [labSpecimens.collectedById],
    references: [users.id],
  }),
  receivedByUser: one(users, {
    fields: [labSpecimens.receivedById],
    references: [users.id],
  }),
  rejectedByUser: one(users, {
    fields: [labSpecimens.rejectedById],
    references: [users.id],
  }),
  results: many(labResults),
  consumableDeductions: many(labConsumableDeductions),
}));

export const labResultsRelations = relations(labResults, ({ one }) => ({
  tenant: one(tenants, {
    fields: [labResults.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [labResults.facilityId],
    references: [facilities.id],
  }),
  specimen: one(labSpecimens, {
    fields: [labResults.specimenId],
    references: [labSpecimens.id],
  }),
  order: one(clinicalOrders, {
    fields: [labResults.orderId],
    references: [clinicalOrders.id],
  }),
  testCatalog: one(labTestCatalog, {
    fields: [labResults.testCatalogId],
    references: [labTestCatalog.id],
  }),
  technologist: one(users, {
    fields: [labResults.technologistId],
    references: [users.id],
  }),
  verifiedByUser: one(users, {
    fields: [labResults.verifiedById],
    references: [users.id],
  }),
}));

export const diagnosticReportsRelations = relations(diagnosticReports, ({ one }) => ({
  tenant: one(tenants, {
    fields: [diagnosticReports.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [diagnosticReports.facilityId],
    references: [facilities.id],
  }),
  order: one(clinicalOrders, {
    fields: [diagnosticReports.orderId],
    references: [clinicalOrders.id],
  }),
  encounter: one(encounters, {
    fields: [diagnosticReports.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [diagnosticReports.patientId],
    references: [patients.id],
  }),
  performer: one(users, {
    fields: [diagnosticReports.performerId],
    references: [users.id],
  }),
  authorizer: one(users, {
    fields: [diagnosticReports.authorizerId],
    references: [users.id],
  }),
}));

export const labConsumablesRelations = relations(labConsumables, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [labConsumables.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [labConsumables.facilityId],
    references: [facilities.id],
  }),
  deductions: many(labConsumableDeductions),
}));

export const labConsumableDeductionsRelations = relations(labConsumableDeductions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [labConsumableDeductions.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [labConsumableDeductions.facilityId],
    references: [facilities.id],
  }),
  consumable: one(labConsumables, {
    fields: [labConsumableDeductions.consumableId],
    references: [labConsumables.id],
  }),
  specimen: one(labSpecimens, {
    fields: [labConsumableDeductions.specimenId],
    references: [labSpecimens.id],
  }),
  order: one(clinicalOrders, {
    fields: [labConsumableDeductions.orderId],
    references: [clinicalOrders.id],
  }),
  deductedByUser: one(users, {
    fields: [labConsumableDeductions.deductedById],
    references: [users.id],
  }),
}));

export const pharmacyProductsRelations = relations(pharmacyProducts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pharmacyProducts.tenantId],
    references: [tenants.id],
  }),
  batches: many(pharmacyBatches),
  stockMovements: many(pharmacyStockMovements),
}));

export const pharmacySuppliersRelations = relations(pharmacySuppliers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pharmacySuppliers.tenantId],
    references: [tenants.id],
  }),
  stockMovements: many(pharmacyStockMovements),
}));

export const pharmacyBatchesRelations = relations(pharmacyBatches, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pharmacyBatches.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [pharmacyBatches.facilityId],
    references: [facilities.id],
  }),
  product: one(pharmacyProducts, {
    fields: [pharmacyBatches.productId],
    references: [pharmacyProducts.id],
  }),
  stockMovements: many(pharmacyStockMovements),
  dispenseItems: many(medicationDispenseItems),
}));

export const pharmacyStockMovementsRelations = relations(pharmacyStockMovements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pharmacyStockMovements.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [pharmacyStockMovements.facilityId],
    references: [facilities.id],
  }),
  product: one(pharmacyProducts, {
    fields: [pharmacyStockMovements.productId],
    references: [pharmacyProducts.id],
  }),
  batch: one(pharmacyBatches, {
    fields: [pharmacyStockMovements.batchId],
    references: [pharmacyBatches.id],
  }),
  supplier: one(pharmacySuppliers, {
    fields: [pharmacyStockMovements.supplierId],
    references: [pharmacySuppliers.id],
  }),
  performedByUser: one(users, {
    fields: [pharmacyStockMovements.performedById],
    references: [users.id],
  }),
}));

export const medicationDispensesRelations = relations(medicationDispenses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [medicationDispenses.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [medicationDispenses.facilityId],
    references: [facilities.id],
  }),
  order: one(clinicalOrders, {
    fields: [medicationDispenses.orderId],
    references: [clinicalOrders.id],
  }),
  medicationRequest: one(medicationRequests, {
    fields: [medicationDispenses.medicationRequestId],
    references: [medicationRequests.id],
  }),
  patient: one(patients, {
    fields: [medicationDispenses.patientId],
    references: [patients.id],
  }),
  encounter: one(encounters, {
    fields: [medicationDispenses.encounterId],
    references: [encounters.id],
  }),
  dispenser: one(users, {
    fields: [medicationDispenses.dispenserId],
    references: [users.id],
  }),
  authorizedByUser: one(users, {
    fields: [medicationDispenses.authorizedById],
    references: [users.id],
  }),
  items: many(medicationDispenseItems),
  administrations: many(medicationAdministrations),
}));

export const medicationDispenseItemsRelations = relations(medicationDispenseItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [medicationDispenseItems.tenantId],
    references: [tenants.id],
  }),
  dispense: one(medicationDispenses, {
    fields: [medicationDispenseItems.dispenseId],
    references: [medicationDispenses.id],
  }),
  batch: one(pharmacyBatches, {
    fields: [medicationDispenseItems.batchId],
    references: [pharmacyBatches.id],
  }),
  product: one(pharmacyProducts, {
    fields: [medicationDispenseItems.productId],
    references: [pharmacyProducts.id],
  }),
}));

export const medicationAdministrationsRelations = relations(medicationAdministrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [medicationAdministrations.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [medicationAdministrations.facilityId],
    references: [facilities.id],
  }),
  dispense: one(medicationDispenses, {
    fields: [medicationAdministrations.dispenseId],
    references: [medicationDispenses.id],
  }),
  medicationRequest: one(medicationRequests, {
    fields: [medicationAdministrations.medicationRequestId],
    references: [medicationRequests.id],
  }),
  encounter: one(encounters, {
    fields: [medicationAdministrations.encounterId],
    references: [encounters.id],
  }),
  patient: one(patients, {
    fields: [medicationAdministrations.patientId],
    references: [patients.id],
  }),
  administrator: one(users, {
    fields: [medicationAdministrations.administratorId],
    references: [users.id],
  }),
}));

export const billingServiceCatalogueRelations = relations(billingServiceCatalogue, ({ one }) => ({
  tenant: one(tenants, {
    fields: [billingServiceCatalogue.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [billingServiceCatalogue.facilityId],
    references: [facilities.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [invoices.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  encounter: one(encounters, {
    fields: [invoices.encounterId],
    references: [encounters.id],
  }),
  finalizedByUser: one(users, {
    fields: [invoices.finalizedById],
    references: [users.id],
  }),
  cancelledByUser: one(users, {
    fields: [invoices.cancelledById],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
  adjustments: many(invoiceAdjustments),
  allocations: many(paymentAllocations),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoiceLineItems.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  billingService: one(billingServiceCatalogue, {
    fields: [invoiceLineItems.billingServiceId],
    references: [billingServiceCatalogue.id],
  }),
}));

export const invoiceAdjustmentsRelations = relations(invoiceAdjustments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoiceAdjustments.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [invoiceAdjustments.facilityId],
    references: [facilities.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceAdjustments.invoiceId],
    references: [invoices.id],
  }),
  lineItem: one(invoiceLineItems, {
    fields: [invoiceAdjustments.lineItemId],
    references: [invoiceLineItems.id],
  }),
  requestedByUser: one(users, {
    fields: [invoiceAdjustments.requestedById],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [invoiceAdjustments.reviewedById],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [payments.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [payments.patientId],
    references: [patients.id],
  }),
  receivedByUser: one(users, {
    fields: [payments.receivedById],
    references: [users.id],
  }),
  allocations: many(paymentAllocations),
  reversals: many(paymentReversals),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentAllocations.tenantId],
    references: [tenants.id],
  }),
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [paymentAllocations.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentReversalsRelations = relations(paymentReversals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentReversals.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [paymentReversals.facilityId],
    references: [facilities.id],
  }),
  payment: one(payments, {
    fields: [paymentReversals.paymentId],
    references: [payments.id],
  }),
  requestedByUser: one(users, {
    fields: [paymentReversals.requestedById],
    references: [users.id],
  }),
  authorizedByUser: one(users, {
    fields: [paymentReversals.authorizedById],
    references: [users.id],
  }),
  creditNoteInvoice: one(invoices, {
    fields: [paymentReversals.creditNoteInvoiceId],
    references: [invoices.id],
  }),
}));

export const dailyReconciliationsRelations = relations(dailyReconciliations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dailyReconciliations.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [dailyReconciliations.facilityId],
    references: [facilities.id],
  }),
  cashier: one(users, {
    fields: [dailyReconciliations.cashierId],
    references: [users.id],
  }),
  supervisor: one(users, {
    fields: [dailyReconciliations.supervisorId],
    references: [users.id],
  }),
}));

/**
 * 23. SHA PREAUTHORIZATIONS
 * Prior authorizations for secondary/tertiary surgical, oncology, renal, and imaging care under SHIF/ECCIF.
 */
export const shaPreauthorizations = pgTable(
  'sha_preauthorizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    preauthNumber: varchar('preauth_number', { length: 64 }).notNull().unique(), // e.g. PA-20261020-00123
    preauthType: varchar('preauth_type', { length: 32 }).notNull(), // NORMAL, ELECTIVE, SURGICAL, ONCOLOGY, RENAL, IMAGING
    fund: varchar('fund', { length: 32 }).notNull(), // SHIF, ECCIF, PHC
    subBenefitCode: varchar('sub_benefit_code', { length: 64 }).notNull(),
    interventionCode: varchar('intervention_code', { length: 64 }).notNull(),
    requestedAmountKES: numeric('requested_amount_kes', { precision: 12, scale: 2 }).notNull(),
    approvedAmountKES: numeric('approved_amount_kes', { precision: 12, scale: 2 }).default('0').notNull(),
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(), // DRAFT, SUBMITTED, APPROVED, PENDING_MANUAL_REVIEW, REJECTED, CANCELLED, EXPIRED
    clinicalSummary: text('clinical_summary').notNull(),
    practitionerPuid: varchar('practitioner_puid', { length: 64 }).notNull(),
    supportingDocumentUrls: jsonb('supporting_document_urls'), // Array of document URLs
    shaReferenceId: varchar('sha_reference_id', { length: 100 }), // Reference returned by SHA
    decisionReason: text('decision_reason'),
    requestedById: uuid('requested_by_id')
      .references(() => users.id)
      .notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_preauth_tenant_idx').on(table.tenantId),
    index('sha_preauth_facility_idx').on(table.facilityId),
    index('sha_preauth_patient_idx').on(table.patientId),
    index('sha_preauth_status_idx').on(table.status),
    uniqueIndex('sha_preauth_number_idx').on(table.preauthNumber),
  ],
);

/**
 * 24. SHA CLAIMS
 * Lifecycle-managed statutory insurance claims dispatched to Social Health Authority.
 */
export const shaClaims = pgTable(
  'sha_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    facilityId: uuid('facility_id')
      .references(() => facilities.id, { onDelete: 'cascade' })
      .notNull(),
    claimNumber: varchar('claim_number', { length: 64 }).notNull(), // e.g. CLM-2026-0001
    version: integer('version').default(1).notNull(), // Increments upon correction/resubmission
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    preauthId: uuid('preauth_id').references(() => shaPreauthorizations.id, { onDelete: 'set null' }),
    fund: varchar('fund', { length: 32 }).notNull(), // PHC, SHIF, ECCIF
    scenario: varchar('scenario', { length: 32 }).notNull(), // SC-01 through SC-08
    accessPoint: varchar('access_point', { length: 32 }).notNull(), // OP, IP, EMERGENCY
    paymentMechanism: varchar('payment_mechanism', { length: 32 }).notNull(), // CAPITATION, FEE_FOR_SERVICE, PER_DIEM
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(), // DRAFT, QUEUED, SUBMITTED, ACKNOWLEDGED, ACCEPTED, REJECTED, ADJUDICATED, PAID, CANCELLED, DISPUTED
    serviceStartDate: timestamp('service_start_date', { withTimezone: true }).notNull(),
    serviceEndDate: timestamp('service_end_date', { withTimezone: true }),
    totalClaimAmountKES: numeric('total_claim_amount_kes', { precision: 12, scale: 2 }).notNull(),
    approvedAmountKES: numeric('approved_amount_kes', { precision: 12, scale: 2 }).default('0').notNull(),
    patientCopayKES: numeric('patient_copay_kes', { precision: 12, scale: 2 }).default('0').notNull(),
    deductionAmountKES: numeric('deduction_amount_kes', { precision: 12, scale: 2 }).default('0').notNull(),
    shaVisitId: varchar('sha_visit_id', { length: 100 }), // Visit ID minted by SHA
    shaTrackingNumber: varchar('sha_tracking_number', { length: 100 }), // Dispatch tracking number
    shaBatchId: varchar('sha_batch_id', { length: 100 }),
    submissionFingerprint: varchar('submission_fingerprint', { length: 100 }), // Idempotency check hash
    rejectionReason: text('rejection_reason'),
    rejectionCodes: jsonb('rejection_codes'), // Array of rejection error codes
    originalClaimId: uuid('original_claim_id'), // Self-reference for corrected resubmissions
    resubmissionCount: integer('resubmission_count').default(0).notNull(),
    dischargeInfo: jsonb('discharge_info'), // { dischargeDate, dischargeType, outcome, attendingPractitionerPuid }
    dispensingInfo: jsonb('dispensing_info'), // { prescriptionId, items, dispensedAt, pharmacistPuid }
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    adjudicatedAt: timestamp('adjudicated_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_claims_tenant_idx').on(table.tenantId),
    index('sha_claims_facility_idx').on(table.facilityId),
    index('sha_claims_patient_idx').on(table.patientId),
    index('sha_claims_status_idx').on(table.status),
    index('sha_claims_fund_scenario_idx').on(table.fund, table.scenario),
    uniqueIndex('sha_claims_tenant_claim_version_idx').on(table.tenantId, table.claimNumber, table.version),
  ],
);

/**
 * 25. SHA CLAIM LINE ITEMS
 * Detailed interventions, services, bed days, and procedures included in the claim.
 */
export const shaClaimItems = pgTable(
  'sha_claim_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    claimId: uuid('claim_id')
      .references(() => shaClaims.id, { onDelete: 'cascade' })
      .notNull(),
    lineType: varchar('line_type', { length: 32 }).notNull(), // INTERVENTION, SERVICE, MEDICATION, LAB, BED_DAY, PROCEDURE
    code: varchar('code', { length: 64 }).notNull(), // ICD-11, LOINC, tariff code
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).default('1').notNull(),
    unitPriceKES: numeric('unit_price_kes', { precision: 12, scale: 2 }).notNull(),
    totalAmountKES: numeric('total_amount_kes', { precision: 12, scale: 2 }).notNull(),
    approvedAmountKES: numeric('approved_amount_kes', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 32 }).default('INCLUDED').notNull(), // INCLUDED, REJECTED, MODIFIED
    serviceDate: timestamp('service_date', { withTimezone: true }).notNull(),
    practitionerPuid: varchar('practitioner_puid', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_claim_items_tenant_idx').on(table.tenantId),
    index('sha_claim_items_claim_idx').on(table.claimId),
  ],
);

/**
 * 26. SHA CLAIM SUBMISSIONS (AUDIT & RECONCILIATION LOG)
 * Immutable log of every HTTP dispatch attempt, correlation ID, payload digest, and outcome.
 */
export const shaClaimSubmissions = pgTable(
  'sha_claim_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    claimId: uuid('claim_id')
      .references(() => shaClaims.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    submissionType: varchar('submission_type', { length: 32 }).default('INITIAL').notNull(), // INITIAL, CORRECTED_RESUBMISSION, DISPUTE_APPEAL
    correlationId: varchar('correlation_id', { length: 100 }).notNull(),
    traceId: varchar('trace_id', { length: 100 }),
    payloadDigest: varchar('payload_digest', { length: 100 }).notNull(), // SHA-256 fingerprint of outbound payload
    requestPayloadRedacted: jsonb('request_payload_redacted').notNull(), // Non-PHI / sanitized snapshot
    responsePayload: jsonb('response_payload'),
    httpStatus: integer('http_status'),
    outcome: varchar('outcome', { length: 32 }).notNull(), // SUCCESS, TIMEOUT, VALIDATION_FAILED, REJECTED, NETWORK_ERROR
    errorMessage: text('error_message'),
    submittedById: uuid('submitted_by_id').references(() => users.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_submissions_tenant_idx').on(table.tenantId),
    index('sha_submissions_claim_idx').on(table.claimId),
    index('sha_submissions_correlation_idx').on(table.correlationId),
  ],
);

/**
 * 27. SHA CLAIM ATTACHMENTS
 * Supporting clinical documentation (operative notes, histology, imaging, emergency triage).
 */
export const shaClaimAttachments = pgTable(
  'sha_claim_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    claimId: uuid('claim_id')
      .references(() => shaClaims.id, { onDelete: 'cascade' })
      .notNull(),
    preauthId: uuid('preauth_id').references(() => shaPreauthorizations.id),
    documentType: varchar('document_type', { length: 32 }).notNull(), // OPERATIVE_NOTES, BIOPSY_HISTOLOGY, DISCHARGE_SUMMARY, DIALYSIS_PLAN, etc.
    title: varchar('title', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    fileUrl: varchar('file_url', { length: 500 }).notNull(),
    shaAttachmentId: varchar('sha_attachment_id', { length: 100 }),
    fileSizeBytes: integer('file_size_bytes'),
    shaUploadStatus: varchar('sha_upload_status', { length: 32 }).default('LOCAL_ONLY').notNull(), // LOCAL_ONLY, UPLOADED_TO_SHA, REJECTED
    uploadedById: uuid('uploaded_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_attachments_tenant_idx').on(table.tenantId),
    index('sha_attachments_claim_idx').on(table.claimId),
  ],
);

/**
 * 28. SHA CALLBACK EVENTS
 * Ingestion log of asynchronous webhook events pushed by SHA (preauth approvals, claim determinations, remittances).
 */
export const shaCallbackEvents = pgTable(
  'sha_callback_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(), // PREAUTH_APPROVED, PREAUTH_REJECTED, CLAIM_PROCESSED, CLAIM_DISPUTED, REMITTANCE_ISSUED
    claimNumber: varchar('claim_number', { length: 64 }),
    preauthNumber: varchar('preauth_number', { length: 64 }),
    externalReference: varchar('external_reference', { length: 100 }),
    traceId: varchar('trace_id', { length: 100 }),
    rawPayload: jsonb('raw_payload').notNull(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingNotes: text('processing_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sha_callbacks_tenant_idx').on(table.tenantId),
    index('sha_callbacks_type_idx').on(table.eventType),
    index('sha_callbacks_claim_idx').on(table.claimNumber),
    index('sha_callbacks_processed_idx').on(table.processed),
  ],
);

// =============================================================================
// RELATIONS FOR SHA ECLAIMS MODULE
// =============================================================================

export const shaPreauthorizationsRelations = relations(shaPreauthorizations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shaPreauthorizations.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [shaPreauthorizations.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [shaPreauthorizations.patientId],
    references: [patients.id],
  }),
  requestedByUser: one(users, {
    fields: [shaPreauthorizations.requestedById],
    references: [users.id],
  }),
  claims: many(shaClaims),
  attachments: many(shaClaimAttachments),
}));

export const shaClaimsRelations = relations(shaClaims, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shaClaims.tenantId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [shaClaims.facilityId],
    references: [facilities.id],
  }),
  patient: one(patients, {
    fields: [shaClaims.patientId],
    references: [patients.id],
  }),
  encounter: one(encounters, {
    fields: [shaClaims.encounterId],
    references: [encounters.id],
  }),
  invoice: one(invoices, {
    fields: [shaClaims.invoiceId],
    references: [invoices.id],
  }),
  preauth: one(shaPreauthorizations, {
    fields: [shaClaims.preauthId],
    references: [shaPreauthorizations.id],
  }),
  items: many(shaClaimItems),
  submissions: many(shaClaimSubmissions),
  attachments: many(shaClaimAttachments),
}));

export const shaClaimItemsRelations = relations(shaClaimItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shaClaimItems.tenantId],
    references: [tenants.id],
  }),
  claim: one(shaClaims, {
    fields: [shaClaimItems.claimId],
    references: [shaClaims.id],
  }),
}));

export const shaClaimSubmissionsRelations = relations(shaClaimSubmissions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shaClaimSubmissions.tenantId],
    references: [tenants.id],
  }),
  claim: one(shaClaims, {
    fields: [shaClaimSubmissions.claimId],
    references: [shaClaims.id],
  }),
  submittedByUser: one(users, {
    fields: [shaClaimSubmissions.submittedById],
    references: [users.id],
  }),
}));

export const shaClaimAttachmentsRelations = relations(shaClaimAttachments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shaClaimAttachments.tenantId],
    references: [tenants.id],
  }),
  claim: one(shaClaims, {
    fields: [shaClaimAttachments.claimId],
    references: [shaClaims.id],
  }),
  preauth: one(shaPreauthorizations, {
    fields: [shaClaimAttachments.preauthId],
    references: [shaPreauthorizations.id],
  }),
  uploadedByUser: one(users, {
    fields: [shaClaimAttachments.uploadedById],
    references: [users.id],
  }),
}));

export const shaCallbackEventsRelations = relations(shaCallbackEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shaCallbackEvents.tenantId],
    references: [tenants.id],
  }),
}));

// ==========================================
// 15. WARDS & BEDS MANAGEMENT
// ==========================================

export const wards = pgTable(
  'wards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    genderRestriction: varchar('gender_restriction', { length: 32 }).default('NONE').notNull(),
    specialty: varchar('specialty', { length: 64 }).default('GENERAL').notNull(),
    floorLocation: varchar('floor_location', { length: 100 }),
    totalBeds: integer('total_beds').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wards_tenant_facility_idx').on(table.tenantId, table.facilityId),
    uniqueIndex('wards_tenant_code_idx').on(table.tenantId, table.facilityId, table.code),
  ],
);

export const beds = pgTable(
  'beds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'cascade' }).notNull(),
    bedNumber: varchar('bed_number', { length: 32 }).notNull(),
    roomNumber: varchar('room_number', { length: 32 }),
    bedType: varchar('bed_type', { length: 32 }).default('STANDARD').notNull(),
    status: varchar('status', { length: 32 }).default('VACANT').notNull(), // VACANT, OCCUPIED, CLEANING, MAINTENANCE, RESERVED
    dailyRate: numeric('daily_rate', { precision: 10, scale: 2 }).default('0.00').notNull(),
    currentAdmissionId: uuid('current_admission_id'),
    active: boolean('active').default(true).notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('beds_tenant_ward_idx').on(table.tenantId, table.wardId),
    index('beds_tenant_status_idx').on(table.tenantId, table.status),
    uniqueIndex('beds_tenant_ward_number_idx').on(table.tenantId, table.wardId, table.bedNumber),
  ],
);

// ==========================================
// 16. INPATIENT ADMISSIONS, DISCHARGES & TRANSFERS (ADT)
// ==========================================

export const inpatientAdmissions = pgTable(
  'inpatient_admissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    admissionNumber: varchar('admission_number', { length: 64 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
    admittingPractitionerId: uuid('admitting_practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    attendingPractitionerId: uuid('attending_practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    admissionDate: timestamp('admission_date', { withTimezone: true }).defaultNow().notNull(),
    admissionType: varchar('admission_type', { length: 32 }).default('EMERGENCY').notNull(),
    admissionDiagnosisIcd11: varchar('admission_diagnosis_icd11', { length: 64 }).notNull(),
    admissionDiagnosisTitle: varchar('admission_diagnosis_title', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).default('ADMITTED').notNull(), // ADMITTED, TRANSFERRED, DISCHARGED, CANCELLED
    currentWardId: uuid('current_ward_id').references(() => wards.id, { onDelete: 'restrict' }).notNull(),
    currentBedId: uuid('current_bed_id').references(() => beds.id, { onDelete: 'restrict' }).notNull(),
    preauthorizationNumber: varchar('preauthorization_number', { length: 64 }),
    dischargeDate: timestamp('discharge_date', { withTimezone: true }),
    dischargeDisposition: varchar('discharge_disposition', { length: 64 }),
    finalDiagnosisIcd11: varchar('final_diagnosis_icd11', { length: 64 }),
    finalDiagnosisTitle: varchar('final_diagnosis_title', { length: 255 }),
    dischargeSummaryNotes: text('discharge_summary_notes'),
    dischargedByPractitionerId: uuid('discharged_by_practitioner_id').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('admissions_tenant_number_idx').on(table.tenantId, table.admissionNumber),
    index('admissions_tenant_patient_idx').on(table.tenantId, table.patientId),
    index('admissions_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const inpatientBedTransfers = pgTable(
  'inpatient_bed_transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    admissionId: uuid('admission_id').references(() => inpatientAdmissions.id, { onDelete: 'cascade' }).notNull(),
    fromWardId: uuid('from_ward_id').references(() => wards.id, { onDelete: 'restrict' }).notNull(),
    fromBedId: uuid('from_bed_id').references(() => beds.id, { onDelete: 'restrict' }).notNull(),
    toWardId: uuid('to_ward_id').references(() => wards.id, { onDelete: 'restrict' }).notNull(),
    toBedId: uuid('to_bed_id').references(() => beds.id, { onDelete: 'restrict' }).notNull(),
    transferDate: timestamp('transfer_date', { withTimezone: true }).defaultNow().notNull(),
    reason: text('reason').notNull(),
    authorizedByPractitionerId: uuid('authorized_by_practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('bed_transfers_tenant_admission_idx').on(table.tenantId, table.admissionId),
  ],
);

// ==========================================
// 17. OPERATING THEATRE & PROCEDURE SCHEDULING
// ==========================================

export const theatres = pgTable(
  'theatres',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    theatreType: varchar('theatre_type', { length: 32 }).default('MAJOR').notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('theatres_tenant_facility_idx').on(table.tenantId, table.facilityId),
  ],
);

export const theatreBookings = pgTable(
  'theatre_bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    bookingNumber: varchar('booking_number', { length: 64 }).notNull(),
    theatreId: uuid('theatre_id').references(() => theatres.id, { onDelete: 'restrict' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    admissionId: uuid('admission_id').references(() => inpatientAdmissions.id, { onDelete: 'set null' }),
    leadSurgeonId: uuid('lead_surgeon_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    anesthetistId: uuid('anesthetist_id').references(() => users.id, { onDelete: 'set null' }),
    procedureCode: varchar('procedure_code', { length: 64 }).notNull(),
    procedureName: varchar('procedure_name', { length: 255 }).notNull(),
    urgency: varchar('urgency', { length: 32 }).default('ELECTIVE').notNull(),
    status: varchar('status', { length: 32 }).default('SCHEDULED').notNull(), // SCHEDULED, PREOP, IN_PROCEDURE, POSTOP, COMPLETED, CANCELLED
    scheduledStartTime: timestamp('scheduled_start_time', { withTimezone: true }).notNull(),
    scheduledEndTime: timestamp('scheduled_end_time', { withTimezone: true }).notNull(),
    actualStartTime: timestamp('actual_start_time', { withTimezone: true }),
    actualEndTime: timestamp('actual_end_time', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    preopChecklistCompleted: boolean('preop_checklist_completed').default(false).notNull(),
    timeOutCompleted: boolean('time_out_completed').default(false).notNull(),
    signOutCompleted: boolean('sign_out_completed').default(false).notNull(),
    whoChecklistData: jsonb('who_checklist_data'),
    anesthesiaNotes: text('anesthesia_notes'),
    operativeNotes: text('operative_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('theatre_bookings_tenant_number_idx').on(table.tenantId, table.bookingNumber),
    index('theatre_bookings_theatre_time_idx').on(table.tenantId, table.theatreId, table.scheduledStartTime),
  ],
);

// ==========================================
// 18. MATERNITY & NEWBORN WORKFLOWS
// ==========================================

export const maternityDeliveries = pgTable(
  'maternity_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    motherPatientId: uuid('mother_patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    admissionId: uuid('admission_id').references(() => inpatientAdmissions.id, { onDelete: 'set null' }),
    deliveryNumber: varchar('delivery_number', { length: 64 }).notNull(),
    gravida: integer('gravida').default(1).notNull(),
    parity: integer('parity').default(0).notNull(),
    gestationalAgeWeeks: numeric('gestational_age_weeks', { precision: 4, scale: 1 }),
    deliveryDate: timestamp('delivery_date', { withTimezone: true }).defaultNow().notNull(),
    deliveryMode: varchar('delivery_mode', { length: 32 }).default('SPONTANEOUS_VAGINAL').notNull(),
    deliveryOutcome: varchar('delivery_outcome', { length: 32 }).default('LIVE_BIRTH').notNull(),
    perinealTear: varchar('perineal_tear', { length: 32 }).default('NONE').notNull(),
    estimatedBloodLossMl: integer('estimated_blood_loss_ml'),
    deliveringClinicianId: uuid('delivering_clinician_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    partographSummary: jsonb('partograph_summary'),
    complications: text('complications'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('maternity_deliveries_tenant_num_idx').on(table.tenantId, table.deliveryNumber),
    index('maternity_deliveries_tenant_mother_idx').on(table.tenantId, table.motherPatientId),
  ],
);

export const newbornProfiles = pgTable(
  'newborn_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    deliveryId: uuid('delivery_id').references(() => maternityDeliveries.id, { onDelete: 'cascade' }).notNull(),
    motherPatientId: uuid('mother_patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    birthDate: timestamp('birth_date', { withTimezone: true }).defaultNow().notNull(),
    birthOrder: integer('birth_order').default(1).notNull(),
    gender: varchar('gender', { length: 32 }).default('INDETERMINATE').notNull(),
    birthWeightGrams: integer('birth_weight_grams').notNull(),
    birthLengthCm: numeric('birth_length_cm', { precision: 4, scale: 1 }),
    headCircumferenceCm: numeric('head_circumference_cm', { precision: 4, scale: 1 }),
    apgarScore1Min: integer('apgar_score_1min').notNull(),
    apgarScore5Min: integer('apgar_score_5min').notNull(),
    apgarScore10Min: integer('apgar_score_10min'),
    resuscitationRequired: boolean('resuscitation_required').default(false).notNull(),
    birthNotificationNumber: varchar('birth_notification_number', { length: 64 }),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('newborn_profiles_tenant_delivery_idx').on(table.tenantId, table.deliveryId),
    index('newborn_profiles_tenant_mother_idx').on(table.tenantId, table.motherPatientId),
  ],
);

// ==========================================
// 19. RADIOLOGY & AUTHORIZED IMAGING
// ==========================================

export const radiologyOrders = pgTable(
  'radiology_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    orderNumber: varchar('order_number', { length: 64 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
    orderingPractitionerId: uuid('ordering_practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    modality: varchar('modality', { length: 32 }).default('XRAY').notNull(),
    procedureCode: varchar('procedure_code', { length: 64 }).notNull(),
    procedureName: varchar('procedure_name', { length: 255 }).notNull(),
    bodySite: varchar('body_site', { length: 100 }).notNull(),
    clinicalIndication: text('clinical_indication').notNull(),
    isConfidentialSpecialist: boolean('is_confidential_specialist').default(false).notNull(),
    urgency: varchar('urgency', { length: 32 }).default('ROUTINE').notNull(),
    status: varchar('status', { length: 32 }).default('REQUESTED').notNull(), // REQUESTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('radiology_orders_tenant_number_idx').on(table.tenantId, table.orderNumber),
    index('radiology_orders_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

export const radiologyReports = pgTable(
  'radiology_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    orderId: uuid('order_id').references(() => radiologyOrders.id, { onDelete: 'cascade' }).notNull(),
    reportNumber: varchar('report_number', { length: 64 }).notNull(),
    radiologistId: uuid('radiologist_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    findings: text('findings').notNull(),
    impression: text('impression').notNull(),
    recommendations: text('recommendations'),
    criticalResult: boolean('critical_result').default(false).notNull(),
    criticalResultNotifiedTo: varchar('critical_result_notified_to', { length: 255 }),
    criticalResultNotifiedAt: timestamp('critical_result_notified_at', { withTimezone: true }),
    pacsStudyUid: varchar('pacs_study_uid', { length: 128 }),
    pacsAccessionNumber: varchar('pacs_accession_number', { length: 64 }),
    pacsViewerUrl: text('pacs_viewer_url'),
    signedAt: timestamp('signed_at', { withTimezone: true }).defaultNow().notNull(),
    addendumNotes: text('addendum_notes'),
    status: varchar('status', { length: 32 }).default('FINAL').notNull(), // DRAFT, PRELIMINARY, FINAL, AMENDED
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('radiology_reports_tenant_number_idx').on(table.tenantId, table.reportNumber),
    index('radiology_reports_tenant_order_idx').on(table.tenantId, table.orderId),
  ],
);

// ==========================================
// 20. REFERRALS & COUNTER-REFERRALS
// ==========================================

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    referralNumber: varchar('referral_number', { length: 64 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
    referralDirection: varchar('referral_direction', { length: 32 }).default('OUTBOUND').notNull(),
    referringFacilityKmfl: varchar('referring_facility_kmfl', { length: 32 }).notNull(),
    referringFacilityName: varchar('referring_facility_name', { length: 255 }).notNull(),
    receivingFacilityKmfl: varchar('receiving_facility_kmfl', { length: 32 }).notNull(),
    receivingFacilityName: varchar('receiving_facility_name', { length: 255 }).notNull(),
    referringPractitionerId: uuid('referring_practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    referringPractitionerName: varchar('referring_practitioner_name', { length: 255 }).notNull(),
    specialtyRequested: varchar('specialty_requested', { length: 64 }).notNull(),
    clinicalSummary: text('clinical_summary').notNull(),
    reasonForReferral: text('reason_for_referral').notNull(),
    priority: varchar('priority', { length: 32 }).default('ROUTINE').notNull(),
    status: varchar('status', { length: 32 }).default('DISPATCHED').notNull(), // DRAFT, DISPATCHED, ACCEPTED, REJECTED, COMPLETED, CANCELLED
    transportType: varchar('transport_type', { length: 32 }).default('AMBULANCE').notNull(),
    ambulanceDetails: jsonb('ambulance_details'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    counterReferralNotes: text('counter_referral_notes'),
    counterReferralPractitionerName: varchar('counter_referral_practitioner_name', { length: 255 }),
    counterReferralDate: timestamp('counter_referral_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('referrals_tenant_number_idx').on(table.tenantId, table.referralNumber),
    index('referrals_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

// ==========================================
// 21. APPOINTMENTS & SCHEDULING
// ==========================================

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    appointmentNumber: varchar('appointment_number', { length: 64 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    practitionerId: uuid('practitioner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    department: varchar('department', { length: 64 }),
    serviceType: varchar('service_type', { length: 64 }).default('GENERAL_CONSULTATION').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').default(30).notNull(),
    status: varchar('status', { length: 32 }).default('SCHEDULED').notNull(), // SCHEDULED, CONFIRMED, CHECKED_IN, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW
    reason: text('reason').notNull(),
    cancellationReason: text('cancellation_reason'),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    checkInTime: timestamp('check_in_time', { withTimezone: true }),
    reminderSent: boolean('reminder_sent').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('appointments_tenant_number_idx').on(table.tenantId, table.appointmentNumber),
    index('appointments_practitioner_time_idx').on(table.tenantId, table.practitionerId, table.startTime),
    index('appointments_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

// ==========================================
// 22. PROCUREMENT & MEDICAL SUPPLIES
// ==========================================

export const procurementOrders = pgTable(
  'procurement_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    poNumber: varchar('po_number', { length: 64 }).notNull(),
    supplierId: uuid('supplier_id').references(() => pharmacySuppliers.id, { onDelete: 'set null' }),
    supplierName: varchar('supplier_name', { length: 255 }).notNull(),
    orderDate: timestamp('order_date', { withTimezone: true }).defaultNow().notNull(),
    expectedDeliveryDate: timestamp('expected_delivery_date', { withTimezone: true }),
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(), // DRAFT, SUBMITTED, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    authorizedByUserId: uuid('authorized_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('procurement_orders_tenant_number_idx').on(table.tenantId, table.poNumber),
  ],
);

export const procurementOrderItems = pgTable(
  'procurement_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    orderId: uuid('order_id').references(() => procurementOrders.id, { onDelete: 'cascade' }).notNull(),
    itemType: varchar('item_type', { length: 32 }).default('MEDICATION').notNull(),
    itemId: uuid('item_id'),
    itemDescription: varchar('item_description', { length: 255 }).notNull(),
    quantityOrdered: numeric('quantity_ordered', { precision: 12, scale: 2 }).notNull(),
    quantityReceived: numeric('quantity_received', { precision: 12, scale: 2 }).default('0').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('procurement_items_tenant_order_idx').on(table.tenantId, table.orderId),
  ],
);

export const goodsReceivedNotes = pgTable(
  'goods_received_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    grnNumber: varchar('grn_number', { length: 64 }).notNull(),
    procurementOrderId: uuid('procurement_order_id').references(() => procurementOrders.id, { onDelete: 'restrict' }).notNull(),
    supplierInvoiceNumber: varchar('supplier_invoice_number', { length: 64 }).notNull(),
    receivedDate: timestamp('received_date', { withTimezone: true }).defaultNow().notNull(),
    receivedByUserId: uuid('received_by_user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    inspectedByUserId: uuid('inspected_by_user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
    inspectionPassed: boolean('inspection_passed').default(true).notNull(),
    inspectionNotes: text('inspection_notes'),
    storageBinLocation: varchar('storage_bin_location', { length: 64 }),
    status: varchar('status', { length: 32 }).default('ACCEPTED').notNull(), // ACCEPTED, PARTIALLY_ACCEPTED, REJECTED
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('grn_tenant_number_idx').on(table.tenantId, table.grnNumber),
    index('grn_tenant_po_idx').on(table.tenantId, table.procurementOrderId),
  ],
);

// ==========================================
// 23. PRIVATE INSURANCE ADAPTERS & POLICIES
// ==========================================

export const insurancePolicies = pgTable(
  'insurance_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    payerCode: varchar('payer_code', { length: 64 }).notNull(), // JUBILEE, AAR, APA, BRITAM, OLD_MUTUAL, etc.
    payerName: varchar('payer_name', { length: 255 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    policyNumber: varchar('policy_number', { length: 64 }).notNull(),
    memberNumber: varchar('member_number', { length: 64 }).notNull(),
    principalMemberName: varchar('principal_member_name', { length: 255 }).notNull(),
    relationshipToPrincipal: varchar('relationship_to_principal', { length: 32 }).default('SELF').notNull(),
    benefitScheme: varchar('benefit_scheme', { length: 100 }).notNull(),
    annualLimit: numeric('annual_limit', { precision: 12, scale: 2 }).notNull(),
    balanceAvailable: numeric('balance_available', { precision: 12, scale: 2 }).notNull(),
    copayAmount: numeric('copay_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
    copayPercentage: numeric('copay_percentage', { precision: 5, scale: 2 }).default('0.00').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    expiryDate: timestamp('expiry_date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('insurance_policies_tenant_policy_idx').on(table.tenantId, table.payerCode, table.memberNumber),
    index('insurance_policies_tenant_patient_idx').on(table.tenantId, table.patientId),
  ],
);

export const insuranceAuthorizations = pgTable(
  'insurance_authorizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    policyId: uuid('policy_id').references(() => insurancePolicies.id, { onDelete: 'cascade' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
    admissionId: uuid('admission_id').references(() => inpatientAdmissions.id, { onDelete: 'set null' }),
    authCode: varchar('auth_code', { length: 64 }).notNull(),
    requestedAmount: numeric('requested_amount', { precision: 12, scale: 2 }).notNull(),
    approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }).notNull(),
    requestedServices: text('requested_services').notNull(),
    status: varchar('status', { length: 32 }).default('PENDING').notNull(), // PENDING, APPROVED, DECLINED, EXPIRED, CANCELLED
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    declineReason: text('decline_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('insurance_auth_tenant_code_idx').on(table.tenantId, table.authCode),
    index('insurance_auth_tenant_policy_idx').on(table.tenantId, table.policyId),
  ],
);

// ==========================================
// 24. DEPARTMENTS & STAFF ROSTERS
// ==========================================

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    headOfDepartmentId: uuid('head_of_department_id').references(() => users.id, { onDelete: 'set null' }),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('departments_tenant_code_idx').on(table.tenantId, table.facilityId, table.code),
  ],
);

export const staffRosters = pgTable(
  'staff_rosters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }).notNull(),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),
    rosterMonth: varchar('roster_month', { length: 7 }).notNull(), // YYYY-MM
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(), // DRAFT, PUBLISHED, ARCHIVED
    publishedByUserId: uuid('published_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('rosters_tenant_dept_month_idx').on(table.tenantId, table.departmentId, table.rosterMonth),
  ],
);

export const staffRosterShifts = pgTable(
  'staff_roster_shifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    rosterId: uuid('roster_id').references(() => staffRosters.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    shiftDate: varchar('shift_date', { length: 10 }).notNull(), // YYYY-MM-DD
    shiftType: varchar('shift_type', { length: 32 }).default('MORNING').notNull(), // MORNING, AFTERNOON, NIGHT, ON_CALL, OFF_DUTY, LEAVE
    assignedWardId: uuid('assigned_ward_id').references(() => wards.id, { onDelete: 'set null' }),
    handoverNotes: text('handover_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('roster_shifts_user_date_idx').on(table.tenantId, table.userId, table.shiftDate),
    index('roster_shifts_tenant_roster_idx').on(table.tenantId, table.rosterId),
  ],
);

// Relations for the new tables
export const wardsRelations = relations(wards, ({ one, many }) => ({
  tenant: one(tenants, { fields: [wards.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [wards.facilityId], references: [facilities.id] }),
  beds: many(beds),
  admissions: many(inpatientAdmissions),
}));

export const bedsRelations = relations(beds, ({ one }) => ({
  tenant: one(tenants, { fields: [beds.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [beds.facilityId], references: [facilities.id] }),
  ward: one(wards, { fields: [beds.wardId], references: [wards.id] }),
  currentAdmission: one(inpatientAdmissions, { fields: [beds.currentAdmissionId], references: [inpatientAdmissions.id] }),
}));

export const inpatientAdmissionsRelations = relations(inpatientAdmissions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [inpatientAdmissions.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [inpatientAdmissions.facilityId], references: [facilities.id] }),
  patient: one(patients, { fields: [inpatientAdmissions.patientId], references: [patients.id] }),
  encounter: one(encounters, { fields: [inpatientAdmissions.encounterId], references: [encounters.id] }),
  currentWard: one(wards, { fields: [inpatientAdmissions.currentWardId], references: [wards.id] }),
  currentBed: one(beds, { fields: [inpatientAdmissions.currentBedId], references: [beds.id] }),
  admittingPractitioner: one(users, { fields: [inpatientAdmissions.admittingPractitionerId], references: [users.id] }),
  attendingPractitioner: one(users, { fields: [inpatientAdmissions.attendingPractitionerId], references: [users.id] }),
  transfers: many(inpatientBedTransfers),
}));

export const inpatientBedTransfersRelations = relations(inpatientBedTransfers, ({ one }) => ({
  tenant: one(tenants, { fields: [inpatientBedTransfers.tenantId], references: [tenants.id] }),
  admission: one(inpatientAdmissions, { fields: [inpatientBedTransfers.admissionId], references: [inpatientAdmissions.id] }),
  fromWard: one(wards, { fields: [inpatientBedTransfers.fromWardId], references: [wards.id] }),
  fromBed: one(beds, { fields: [inpatientBedTransfers.fromBedId], references: [beds.id] }),
  toWard: one(wards, { fields: [inpatientBedTransfers.toWardId], references: [wards.id] }),
  toBed: one(beds, { fields: [inpatientBedTransfers.toBedId], references: [beds.id] }),
}));

export const theatresRelations = relations(theatres, ({ one, many }) => ({
  tenant: one(tenants, { fields: [theatres.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [theatres.facilityId], references: [facilities.id] }),
  bookings: many(theatreBookings),
}));

export const theatreBookingsRelations = relations(theatreBookings, ({ one }) => ({
  tenant: one(tenants, { fields: [theatreBookings.tenantId], references: [tenants.id] }),
  theatre: one(theatres, { fields: [theatreBookings.theatreId], references: [theatres.id] }),
  patient: one(patients, { fields: [theatreBookings.patientId], references: [patients.id] }),
  admission: one(inpatientAdmissions, { fields: [theatreBookings.admissionId], references: [inpatientAdmissions.id] }),
  leadSurgeon: one(users, { fields: [theatreBookings.leadSurgeonId], references: [users.id] }),
  anesthetist: one(users, { fields: [theatreBookings.anesthetistId], references: [users.id] }),
}));

export const maternityDeliveriesRelations = relations(maternityDeliveries, ({ one, many }) => ({
  tenant: one(tenants, { fields: [maternityDeliveries.tenantId], references: [tenants.id] }),
  mother: one(patients, { fields: [maternityDeliveries.motherPatientId], references: [patients.id] }),
  admission: one(inpatientAdmissions, { fields: [maternityDeliveries.admissionId], references: [inpatientAdmissions.id] }),
  deliveringClinician: one(users, { fields: [maternityDeliveries.deliveringClinicianId], references: [users.id] }),
  newborns: many(newbornProfiles),
}));

export const newbornProfilesRelations = relations(newbornProfiles, ({ one }) => ({
  tenant: one(tenants, { fields: [newbornProfiles.tenantId], references: [tenants.id] }),
  delivery: one(maternityDeliveries, { fields: [newbornProfiles.deliveryId], references: [maternityDeliveries.id] }),
  mother: one(patients, { fields: [newbornProfiles.motherPatientId], references: [patients.id] }),
  patient: one(patients, { fields: [newbornProfiles.patientId], references: [patients.id] }),
}));

export const radiologyOrdersRelations = relations(radiologyOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [radiologyOrders.tenantId], references: [tenants.id] }),
  patient: one(patients, { fields: [radiologyOrders.patientId], references: [patients.id] }),
  encounter: one(encounters, { fields: [radiologyOrders.encounterId], references: [encounters.id] }),
  orderingPractitioner: one(users, { fields: [radiologyOrders.orderingPractitionerId], references: [users.id] }),
  reports: many(radiologyReports),
}));

export const radiologyReportsRelations = relations(radiologyReports, ({ one }) => ({
  tenant: one(tenants, { fields: [radiologyReports.tenantId], references: [tenants.id] }),
  order: one(radiologyOrders, { fields: [radiologyReports.orderId], references: [radiologyOrders.id] }),
  radiologist: one(users, { fields: [radiologyReports.radiologistId], references: [users.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  tenant: one(tenants, { fields: [referrals.tenantId], references: [tenants.id] }),
  patient: one(patients, { fields: [referrals.patientId], references: [patients.id] }),
  encounter: one(encounters, { fields: [referrals.encounterId], references: [encounters.id] }),
  referringPractitioner: one(users, { fields: [referrals.referringPractitionerId], references: [users.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  tenant: one(tenants, { fields: [appointments.tenantId], references: [tenants.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  practitioner: one(users, { fields: [appointments.practitionerId], references: [users.id] }),
}));

export const procurementOrdersRelations = relations(procurementOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [procurementOrders.tenantId], references: [tenants.id] }),
  supplier: one(pharmacySuppliers, { fields: [procurementOrders.supplierId], references: [pharmacySuppliers.id] }),
  items: many(procurementOrderItems),
  grns: many(goodsReceivedNotes),
}));

export const procurementOrderItemsRelations = relations(procurementOrderItems, ({ one }) => ({
  tenant: one(tenants, { fields: [procurementOrderItems.tenantId], references: [tenants.id] }),
  order: one(procurementOrders, { fields: [procurementOrderItems.orderId], references: [procurementOrders.id] }),
}));

export const goodsReceivedNotesRelations = relations(goodsReceivedNotes, ({ one }) => ({
  tenant: one(tenants, { fields: [goodsReceivedNotes.tenantId], references: [tenants.id] }),
  procurementOrder: one(procurementOrders, { fields: [goodsReceivedNotes.procurementOrderId], references: [procurementOrders.id] }),
  receivedByUser: one(users, { fields: [goodsReceivedNotes.receivedByUserId], references: [users.id] }),
  inspectedByUser: one(users, { fields: [goodsReceivedNotes.inspectedByUserId], references: [users.id] }),
}));

export const insurancePoliciesRelations = relations(insurancePolicies, ({ one, many }) => ({
  tenant: one(tenants, { fields: [insurancePolicies.tenantId], references: [tenants.id] }),
  patient: one(patients, { fields: [insurancePolicies.patientId], references: [patients.id] }),
  authorizations: many(insuranceAuthorizations),
}));

export const insuranceAuthorizationsRelations = relations(insuranceAuthorizations, ({ one }) => ({
  tenant: one(tenants, { fields: [insuranceAuthorizations.tenantId], references: [tenants.id] }),
  policy: one(insurancePolicies, { fields: [insuranceAuthorizations.policyId], references: [insurancePolicies.id] }),
  patient: one(patients, { fields: [insuranceAuthorizations.patientId], references: [patients.id] }),
  admission: one(inpatientAdmissions, { fields: [insuranceAuthorizations.admissionId], references: [inpatientAdmissions.id] }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [departments.tenantId], references: [tenants.id] }),
  headOfDepartment: one(users, { fields: [departments.headOfDepartmentId], references: [users.id] }),
  rosters: many(staffRosters),
}));

export const staffRostersRelations = relations(staffRosters, ({ one, many }) => ({
  tenant: one(tenants, { fields: [staffRosters.tenantId], references: [tenants.id] }),
  department: one(departments, { fields: [staffRosters.departmentId], references: [departments.id] }),
  shifts: many(staffRosterShifts),
}));

export const staffRosterShiftsRelations = relations(staffRosterShifts, ({ one }) => ({
  tenant: one(tenants, { fields: [staffRosterShifts.tenantId], references: [tenants.id] }),
  roster: one(staffRosters, { fields: [staffRosterShifts.rosterId], references: [staffRosters.id] }),
  user: one(users, { fields: [staffRosterShifts.userId], references: [users.id] }),
  assignedWard: one(wards, { fields: [staffRosterShifts.assignedWardId], references: [wards.id] }),
}));

// ==========================================
// 25. COMMERCIAL SAAS ADMINISTRATION TABLES
// ==========================================

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    facilityLevel: varchar('facility_level', { length: 32 }).notNull(),
    billingCycle: varchar('billing_cycle', { length: 32 }).default('MONTHLY').notNull(),
    basePriceKes: numeric('base_price_kes', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 8 }).default('KES').notNull(),
    maxUsers: integer('max_users').notNull(),
    maxMonthlyEncounters: integer('max_monthly_encounters').notNull(),
    maxStorageGb: integer('max_storage_gb').notNull(),
    features: jsonb('features').notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subscription_plans_code_idx').on(table.code),
    index('subscription_plans_active_idx').on(table.active),
  ],
);

export const tenantSubscriptions = pgTable(
  'tenant_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'restrict' }).notNull(),
    status: varchar('status', { length: 32 }).default('TRIAL').notNull(),
    billingCycle: varchar('billing_cycle', { length: 32 }).default('MONTHLY').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    autoRenew: boolean('auto_renew').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tenant_subscriptions_tenant_idx').on(table.tenantId),
    index('tenant_subscriptions_status_idx').on(table.status),
  ],
);

export const subscriptionHistory = pgTable(
  'subscription_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id').references(() => tenantSubscriptions.id, { onDelete: 'cascade' }).notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    previousPlanId: uuid('previous_plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
    newPlanId: uuid('new_plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
    previousStatus: varchar('previous_status', { length: 32 }),
    newStatus: varchar('new_status', { length: 32 }),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    effectiveDate: timestamp('effective_date', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('subscription_history_tenant_idx').on(table.tenantId),
    index('subscription_history_subscription_idx').on(table.subscriptionId),
  ],
);

export const tenantEntitlements = pgTable(
  'tenant_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull().unique(),
    planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'restrict' }).notNull(),
    maxUsers: integer('max_users').notNull(),
    maxMonthlyEncounters: integer('max_monthly_encounters').notNull(),
    maxStorageGb: integer('max_storage_gb').notNull(),
    features: jsonb('features').notNull(),
    customOverrides: jsonb('custom_overrides'),
    enforceHardLimits: boolean('enforce_hard_limits').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_entitlements_tenant_idx').on(table.tenantId),
  ],
);

export const tenantUsageMeters = pgTable(
  'tenant_usage_meters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    metricType: varchar('metric_type', { length: 64 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    quantity: integer('quantity').default(0).notNull(),
    lastRecordedAt: timestamp('last_recorded_at', { withTimezone: true }).defaultNow().notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tenant_usage_meters_tenant_idx').on(table.tenantId),
    uniqueIndex('tenant_usage_meters_period_metric_idx').on(table.tenantId, table.metricType, table.periodStart),
  ],
);

export const platformInvoices = pgTable(
  'platform_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    subscriptionId: uuid('subscription_id').references(() => tenantSubscriptions.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull().unique(),
    billingPeriodStart: timestamp('billing_period_start', { withTimezone: true }).notNull(),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }).notNull(),
    subtotalKes: numeric('subtotal_kes', { precision: 12, scale: 2 }).notNull(),
    taxKes: numeric('tax_kes', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalKes: numeric('total_kes', { precision: 12, scale: 2 }).notNull(),
    amountPaidKes: numeric('amount_paid_kes', { precision: 12, scale: 2 }).default('0.00').notNull(),
    status: varchar('status', { length: 32 }).default('DRAFT').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).unique(),
    kraControlCode: varchar('kra_control_code', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_invoices_number_idx').on(table.invoiceNumber),
    uniqueIndex('platform_invoices_idempotency_idx').on(table.idempotencyKey),
    index('platform_invoices_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const platformInvoiceItems = pgTable(
  'platform_invoice_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    invoiceId: uuid('invoice_id').references(() => platformInvoices.id, { onDelete: 'cascade' }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    unitPriceKes: numeric('unit_price_kes', { precision: 12, scale: 2 }).notNull(),
    totalPriceKes: numeric('total_price_kes', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('platform_invoice_items_invoice_idx').on(table.invoiceId),
    index('platform_invoice_items_tenant_idx').on(table.tenantId),
  ],
);

export const platformPayments = pgTable(
  'platform_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    invoiceId: uuid('invoice_id').references(() => platformInvoices.id, { onDelete: 'cascade' }).notNull(),
    amountKes: numeric('amount_kes', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).notNull(),
    referenceNumber: varchar('reference_number', { length: 64 }).notNull(),
    checkoutRequestId: varchar('checkout_request_id', { length: 128 }),
    status: varchar('status', { length: 32 }).default('INITIATED').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).unique(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('platform_payments_tenant_idx').on(table.tenantId),
    index('platform_payments_invoice_idx').on(table.invoiceId),
    uniqueIndex('platform_payments_idempotency_idx').on(table.idempotencyKey),
  ],
);

export const platformDunningEvents = pgTable(
  'platform_dunning_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    subscriptionId: uuid('subscription_id').references(() => tenantSubscriptions.id, { onDelete: 'cascade' }).notNull(),
    invoiceId: uuid('invoice_id').references(() => platformInvoices.id, { onDelete: 'cascade' }).notNull(),
    stage: varchar('stage', { length: 32 }).notNull(),
    attemptNumber: integer('attempt_number').default(1).notNull(),
    message: text('message').notNull(),
    actionTaken: varchar('action_taken', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('platform_dunning_tenant_idx').on(table.tenantId),
    index('platform_dunning_sub_idx').on(table.subscriptionId),
  ],
);

export const supportCases = pgTable(
  'support_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    caseNumber: varchar('case_number', { length: 32 }).notNull().unique(),
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    priority: varchar('priority', { length: 32 }).default('MEDIUM').notNull(),
    status: varchar('status', { length: 32 }).default('OPEN').notNull(),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('support_cases_number_idx').on(table.caseNumber),
    index('support_cases_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const supportCaseMessages = pgTable(
  'support_case_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    caseId: uuid('case_id').references(() => supportCases.id, { onDelete: 'cascade' }).notNull(),
    senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    isStaff: boolean('is_staff').default(false).notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('support_case_messages_case_idx').on(table.caseId),
    index('support_case_messages_tenant_idx').on(table.tenantId),
  ],
);

export const supportAccessGrants = pgTable(
  'support_access_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    grantedByUserId: uuid('granted_by_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    supportUserId: uuid('support_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    reason: text('reason').notNull(),
    scope: varchar('scope', { length: 64 }).default('READ_ONLY').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('support_access_grants_tenant_idx').on(table.tenantId),
    uniqueIndex('support_access_grants_token_idx').on(table.tokenHash),
  ],
);

export const tenantOffboardingRequests = pgTable(
  'tenant_offboarding_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 }).default('REQUESTED').notNull(),
    reason: text('reason').notNull(),
    clinicalDataRetentionUntil: timestamp('clinical_data_retention_until', { withTimezone: true }).notNull(),
    exportBundleUrl: text('export_bundle_url'),
    exportChecksumSha256: varchar('export_checksum_sha256', { length: 64 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('offboarding_requests_tenant_idx').on(table.tenantId),
    index('offboarding_requests_status_idx').on(table.status),
  ],
);

// Relations for Commercial SaaS Administration
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(tenantSubscriptions),
  entitlements: many(tenantEntitlements),
}));

export const tenantSubscriptionsRelations = relations(tenantSubscriptions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [tenantSubscriptions.tenantId], references: [tenants.id] }),
  plan: one(subscriptionPlans, { fields: [tenantSubscriptions.planId], references: [subscriptionPlans.id] }),
  history: many(subscriptionHistory),
  invoices: many(platformInvoices),
  dunningEvents: many(platformDunningEvents),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  subscription: one(tenantSubscriptions, { fields: [subscriptionHistory.subscriptionId], references: [tenantSubscriptions.id] }),
  tenant: one(tenants, { fields: [subscriptionHistory.tenantId], references: [tenants.id] }),
  previousPlan: one(subscriptionPlans, { fields: [subscriptionHistory.previousPlanId], references: [subscriptionPlans.id] }),
  newPlan: one(subscriptionPlans, { fields: [subscriptionHistory.newPlanId], references: [subscriptionPlans.id] }),
  changedByUser: one(users, { fields: [subscriptionHistory.changedByUserId], references: [users.id] }),
}));

export const tenantEntitlementsRelations = relations(tenantEntitlements, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantEntitlements.tenantId], references: [tenants.id] }),
  plan: one(subscriptionPlans, { fields: [tenantEntitlements.planId], references: [subscriptionPlans.id] }),
}));

export const tenantUsageMetersRelations = relations(tenantUsageMeters, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsageMeters.tenantId], references: [tenants.id] }),
}));

export const platformInvoicesRelations = relations(platformInvoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [platformInvoices.tenantId], references: [tenants.id] }),
  subscription: one(tenantSubscriptions, { fields: [platformInvoices.subscriptionId], references: [tenantSubscriptions.id] }),
  items: many(platformInvoiceItems),
  payments: many(platformPayments),
  dunningEvents: many(platformDunningEvents),
}));

export const platformInvoiceItemsRelations = relations(platformInvoiceItems, ({ one }) => ({
  tenant: one(tenants, { fields: [platformInvoiceItems.tenantId], references: [tenants.id] }),
  invoice: one(platformInvoices, { fields: [platformInvoiceItems.invoiceId], references: [platformInvoices.id] }),
}));

export const platformPaymentsRelations = relations(platformPayments, ({ one }) => ({
  tenant: one(tenants, { fields: [platformPayments.tenantId], references: [tenants.id] }),
  invoice: one(platformInvoices, { fields: [platformPayments.invoiceId], references: [platformInvoices.id] }),
}));

export const platformDunningEventsRelations = relations(platformDunningEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [platformDunningEvents.tenantId], references: [tenants.id] }),
  subscription: one(tenantSubscriptions, { fields: [platformDunningEvents.subscriptionId], references: [tenantSubscriptions.id] }),
  invoice: one(platformInvoices, { fields: [platformDunningEvents.invoiceId], references: [platformInvoices.id] }),
}));

export const supportCasesRelations = relations(supportCases, ({ one, many }) => ({
  tenant: one(tenants, { fields: [supportCases.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [supportCases.facilityId], references: [facilities.id] }),
  createdByUser: one(users, { fields: [supportCases.createdByUserId], references: [users.id] }),
  assignedToUser: one(users, { fields: [supportCases.assignedToUserId], references: [users.id] }),
  messages: many(supportCaseMessages),
}));

export const supportCaseMessagesRelations = relations(supportCaseMessages, ({ one }) => ({
  tenant: one(tenants, { fields: [supportCaseMessages.tenantId], references: [tenants.id] }),
  case: one(supportCases, { fields: [supportCaseMessages.caseId], references: [supportCases.id] }),
  senderUser: one(users, { fields: [supportCaseMessages.senderUserId], references: [users.id] }),
}));

export const supportAccessGrantsRelations = relations(supportAccessGrants, ({ one }) => ({
  tenant: one(tenants, { fields: [supportAccessGrants.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [supportAccessGrants.facilityId], references: [facilities.id] }),
  grantedByUser: one(users, { fields: [supportAccessGrants.grantedByUserId], references: [users.id] }),
  supportUser: one(users, { fields: [supportAccessGrants.supportUserId], references: [users.id] }),
}));

export const tenantOffboardingRequestsRelations = relations(tenantOffboardingRequests, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantOffboardingRequests.tenantId], references: [tenants.id] }),
  requestedByUser: one(users, { fields: [tenantOffboardingRequests.requestedByUserId], references: [users.id] }),
  approvedByUser: one(users, { fields: [tenantOffboardingRequests.approvedByUserId], references: [users.id] }),
}));

