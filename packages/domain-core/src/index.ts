/**
 * COMKEY AFYA POA — Core Domain Primitives, Permissions and Shared Types
 */

export * from './crypto.js';

export enum FacilityLevel {
  LEVEL_2_DISPENSARY = 'LEVEL_2',
  LEVEL_3_HEALTH_CENTRE = 'LEVEL_3',
  LEVEL_4_SUB_COUNTY = 'LEVEL_4',
  LEVEL_5_COUNTY_REFERRAL = 'LEVEL_5',
  LEVEL_6_NATIONAL = 'LEVEL_6',
}

export enum FacilityOwnership {
  PUBLIC = 'PUBLIC',
  FAITH_BASED = 'FAITH_BASED',
  PRIVATE = 'PRIVATE',
  NGO = 'NGO',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Platform Super-Admin (Global SaaS operator)
  FACILITY_ADMIN = 'FACILITY_ADMIN', // Hospital Administrator
  FINANCE_USER = 'FINANCE_USER', // Commercial / Finance User
  CLINICIAN = 'CLINICIAN', // Medical Officer / Doctor / Specialist
  TRIAGE_NURSE = 'TRIAGE_NURSE', // Triage / Inpatient Nurse
  LAB_TECH = 'LAB_TECH', // Laboratory Technologist
  PHARMACIST = 'PHARMACIST', // Pharmacist / Pharmacy Tech
  BILLING_CLERK = 'BILLING_CLERK', // Cashier / Billing & Claims Clerk
  RECORDS_OFFICER = 'RECORDS_OFFICER', // Health Records & Information Officer
}

export enum Permission {
  // Tenancy & Administration
  TENANT_READ = 'tenant:read',
  TENANT_WRITE = 'tenant:write',
  FACILITY_MANAGE = 'facility:manage',
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_ROLE_ASSIGN = 'user:role:assign',
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',

  // Clinical & Triage
  PATIENT_REGISTER = 'patient:register',
  PATIENT_READ = 'patient:read',
  PATIENT_WRITE = 'patient:write',
  ENCOUNTER_CREATE = 'encounter:create',
  ENCOUNTER_READ = 'encounter:read',
  ENCOUNTER_UPDATE = 'encounter:update',
  ENCOUNTER_CLOSE = 'encounter:close',
  ENCOUNTER_REOPEN = 'encounter:reopen',
  TRIAGE_WRITE = 'triage:write',
  CLINICAL_NOTE_WRITE = 'clinical:note:write',
  CLINICAL_NOTE_SIGN = 'clinical:note:sign',
  CLINICAL_NOTE_AMEND = 'clinical:note:amend',
  ALLERGY_MANAGE = 'allergy:manage',
  CLINICAL_ORDER_READ = 'clinical:order:read',
  CLINICAL_ORDER_WRITE = 'clinical:order:write',
  CLINICAL_ORDER_AUTHORIZE = 'clinical:order:authorize',
  CLINICAL_ORDER_CANCEL = 'clinical:order:cancel',
  DIAGNOSIS_READ = 'diagnosis:read',
  DIAGNOSIS_WRITE = 'diagnosis:write',
  TERMINOLOGY_READ = 'terminology:read',
  TERMINOLOGY_MANAGE = 'terminology:manage',

  // Diagnostics & Pharmacy
  LAB_READ = 'lab:read',
  LAB_WRITE = 'lab:write',
  LAB_ORDER_EXECUTE = 'lab:order:execute',
  LAB_RESULT_AUTHORIZE = 'lab:result:authorize',
  LAB_REJECT = 'lab:reject',
  LAB_ADMIN = 'lab:admin',
  PHARMACY_READ = 'pharmacy:read',
  PHARMACY_WRITE = 'pharmacy:write',
  PHARMACY_DISPENSE = 'pharmacy:dispense',
  PHARMACY_INVENTORY_MANAGE = 'pharmacy:inventory:manage',
  PHARMACY_RETURN = 'pharmacy:return',
  PHARMACY_ADMIN = 'pharmacy:admin',
  MEDICATION_ADMINISTER = 'medication:administer',
  INVENTORY_MANAGE = 'inventory:manage',

  // Billing & Claims
  BILL_VIEW = 'bill:view',
  BILL_WRITE = 'bill:write',
  BILL_MANAGE = 'bill:manage',
  BILL_ADJUST_AUTHORIZE = 'bill:adjust:authorize',
  PAYMENT_PROCESS = 'payment:process',
  PAYMENT_REFUND = 'payment:refund',
  RECONCILIATION_MANAGE = 'reconciliation:manage',
  SHA_CLAIM_SUBMIT = 'sha:claim:submit',
  SHA_CLAIM_READ = 'sha:claim:read',
  SHA_PREAUTH_MANAGE = 'sha:preauth:manage',
  SHA_CLAIM_RECONCILE = 'sha:claim:reconcile',
  KRA_ETIMS_SIGN = 'kra:etims:sign',

  // Patient Identity & Consent Management
  PATIENT_RECONCILE = 'patient:reconcile',
  PATIENT_CONSENT_MANAGE = 'patient:consent:manage',
  PATIENT_EXPORT = 'patient:export',

  // FHIR R4 Interoperability
  FHIR_VALIDATE = 'fhir:validate',
  FHIR_EXCHANGE = 'fhir:exchange',
  FHIR_EXPORT = 'fhir:export',

  // Registry Synchronization & Resilient Integration Operations
  REGISTRY_SYNC_TRIGGER = 'registry:sync:trigger',
  REGISTRY_SYNC_READ = 'registry:sync:read',
  REGISTRY_REPLAY_MANAGE = 'registry:replay:manage',
  INTEGRATION_HEALTH_READ = 'integration:health:read',

  // 1. Inpatient Admission, Discharge & Transfer (ADT) + Ward & Bed Management
  INPATIENT_ADMIT = 'inpatient:admit',
  INPATIENT_READ = 'inpatient:read',
  INPATIENT_TRANSFER = 'inpatient:transfer',
  INPATIENT_DISCHARGE = 'inpatient:discharge',
  INPATIENT_CANCEL = 'inpatient:cancel',
  WARD_MANAGE = 'ward:manage',
  BED_MANAGE = 'bed:manage',
  BED_VIEW = 'bed:view',

  // 2. Operating Theatre & Procedure Scheduling
  THEATRE_MANAGE = 'theatre:manage',
  THEATRE_BOOK = 'theatre:book',
  THEATRE_READ = 'theatre:read',
  THEATRE_UPDATE = 'theatre:update',
  THEATRE_CANCEL = 'theatre:cancel',
  THEATRE_CHECKLIST_SIGN = 'theatre:checklist:sign',

  // 3. Maternity & Newborn
  MATERNITY_READ = 'maternity:read',
  MATERNITY_WRITE = 'maternity:write',
  NEWBORN_REGISTER = 'newborn:register',
  NEWBORN_READ = 'newborn:read',

  // 4. Radiology & Authorized Imaging
  RADIOLOGY_ORDER = 'radiology:order',
  RADIOLOGY_READ = 'radiology:read',
  RADIOLOGY_REPORT_WRITE = 'radiology:report:write',
  RADIOLOGY_REPORT_SIGN = 'radiology:report:sign',
  RADIOLOGY_SPECIALIST_READ = 'radiology:specialist:read',

  // 5. Referrals & Counter-Referrals
  REFERRAL_CREATE = 'referral:create',
  REFERRAL_READ = 'referral:read',
  REFERRAL_UPDATE = 'referral:update',
  REFERRAL_CANCEL = 'referral:cancel',

  // 6. Appointments & Scheduling
  APPOINTMENT_CREATE = 'appointment:create',
  APPOINTMENT_READ = 'appointment:read',
  APPOINTMENT_UPDATE = 'appointment:update',
  APPOINTMENT_CANCEL = 'appointment:cancel',

  // 7. Medical Supplies & Procurement
  PROCUREMENT_CREATE = 'procurement:create',
  PROCUREMENT_READ = 'procurement:read',
  PROCUREMENT_APPROVE = 'procurement:approve',
  GRN_MANAGE = 'grn:manage',

  // 8. Private Insurance Adapters
  PRIVATE_INSURANCE_MANAGE = 'private_insurance:manage',
  PRIVATE_INSURANCE_READ = 'private_insurance:read',
  PRIVATE_INSURANCE_AUTH = 'private_insurance:auth',

  // 9. Staff Rosters & Departmental Assignments
  DEPARTMENT_MANAGE = 'department:manage',
  ROSTER_MANAGE = 'roster:manage',
  ROSTER_READ = 'roster:read',

  // 10. Commercial SaaS Administration (Platform & Tenant)
  PLATFORM_TENANT_MANAGE = 'platform:tenant:manage',
  PLATFORM_PLAN_MANAGE = 'platform:plan:manage',
  PLATFORM_SUBSCRIPTION_MANAGE = 'platform:subscription:manage',
  PLATFORM_INVOICE_MANAGE = 'platform:invoice:manage',
  PLATFORM_METRICS_READ = 'platform:metrics:read',
  PLATFORM_SUPPORT_MANAGE = 'platform:support:manage',
  PLATFORM_SUPPORT_ACCESS = 'platform:support:access',
  PLATFORM_OFFBOARDING_MANAGE = 'platform:offboarding:manage',

  // Hospital Administration (Tenant level)
  TENANT_CONFIG_MANAGE = 'tenant:config:manage',
  TENANT_SUBSCRIPTION_READ = 'tenant:subscription:read',
  TENANT_SUBSCRIPTION_MANAGE = 'tenant:subscription:manage',
  TENANT_USAGE_READ = 'tenant:usage:read',
  TENANT_SUPPORT_CREATE = 'tenant:support:create',
  TENANT_SUPPORT_GRANT = 'tenant:support:grant',
  TENANT_OFFBOARDING_REQUEST = 'tenant:offboarding:request',

  // Commercial Finance User (Tenant level)
  TENANT_INVOICE_READ = 'tenant:invoice:read',
  TENANT_INVOICE_PAY = 'tenant:invoice:pay',
  TENANT_BILLING_RECONCILE = 'tenant:billing:reconcile',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.FACILITY_ADMIN]: [
    Permission.TENANT_READ,
    Permission.FACILITY_MANAGE,
    Permission.USER_READ,
    Permission.USER_WRITE,
    Permission.USER_ROLE_ASSIGN,
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
    Permission.PATIENT_READ,
    Permission.BILL_VIEW,
    Permission.BILL_WRITE,
    Permission.BILL_MANAGE,
    Permission.BILL_ADJUST_AUTHORIZE,
    Permission.PAYMENT_PROCESS,
    Permission.PAYMENT_REFUND,
    Permission.RECONCILIATION_MANAGE,
    Permission.SHA_CLAIM_SUBMIT,
    Permission.SHA_CLAIM_READ,
    Permission.SHA_PREAUTH_MANAGE,
    Permission.SHA_CLAIM_RECONCILE,
    Permission.KRA_ETIMS_SIGN,
    Permission.INVENTORY_MANAGE,
    Permission.PATIENT_REGISTER,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_RECONCILE,
    Permission.PATIENT_CONSENT_MANAGE,
    Permission.PATIENT_EXPORT,
    Permission.ENCOUNTER_CREATE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_UPDATE,
    Permission.ENCOUNTER_CLOSE,
    Permission.ENCOUNTER_REOPEN,
    Permission.TRIAGE_WRITE,
    Permission.CLINICAL_NOTE_WRITE,
    Permission.CLINICAL_NOTE_SIGN,
    Permission.CLINICAL_NOTE_AMEND,
    Permission.ALLERGY_MANAGE,
    Permission.CLINICAL_ORDER_READ,
    Permission.CLINICAL_ORDER_WRITE,
    Permission.CLINICAL_ORDER_AUTHORIZE,
    Permission.CLINICAL_ORDER_CANCEL,
    Permission.DIAGNOSIS_READ,
    Permission.DIAGNOSIS_WRITE,
    Permission.TERMINOLOGY_READ,
    Permission.TERMINOLOGY_MANAGE,
    Permission.LAB_READ,
    Permission.LAB_WRITE,
    Permission.LAB_ORDER_EXECUTE,
    Permission.LAB_RESULT_AUTHORIZE,
    Permission.LAB_REJECT,
    Permission.LAB_ADMIN,
    Permission.PHARMACY_READ,
    Permission.PHARMACY_WRITE,
    Permission.PHARMACY_DISPENSE,
    Permission.PHARMACY_INVENTORY_MANAGE,
    Permission.PHARMACY_RETURN,
    Permission.PHARMACY_ADMIN,
    Permission.MEDICATION_ADMINISTER,
    Permission.FHIR_VALIDATE,
    Permission.FHIR_EXCHANGE,
    Permission.FHIR_EXPORT,
    Permission.REGISTRY_SYNC_TRIGGER,
    Permission.REGISTRY_SYNC_READ,
    Permission.REGISTRY_REPLAY_MANAGE,
    Permission.INTEGRATION_HEALTH_READ,
    // Phase 2 Hospital Ops - Facility Admin
    Permission.INPATIENT_ADMIT,
    Permission.INPATIENT_READ,
    Permission.INPATIENT_TRANSFER,
    Permission.INPATIENT_DISCHARGE,
    Permission.INPATIENT_CANCEL,
    Permission.WARD_MANAGE,
    Permission.BED_VIEW,
    Permission.BED_MANAGE,
    Permission.THEATRE_MANAGE,
    Permission.THEATRE_BOOK,
    Permission.THEATRE_READ,
    Permission.THEATRE_UPDATE,
    Permission.THEATRE_CANCEL,
    Permission.THEATRE_CHECKLIST_SIGN,
    Permission.MATERNITY_READ,
    Permission.MATERNITY_WRITE,
    Permission.NEWBORN_REGISTER,
    Permission.NEWBORN_READ,
    Permission.RADIOLOGY_ORDER,
    Permission.RADIOLOGY_READ,
    Permission.RADIOLOGY_REPORT_WRITE,
    Permission.RADIOLOGY_REPORT_SIGN,
    Permission.RADIOLOGY_SPECIALIST_READ,
    Permission.REFERRAL_CREATE,
    Permission.REFERRAL_READ,
    Permission.REFERRAL_UPDATE,
    Permission.REFERRAL_CANCEL,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.PROCUREMENT_CREATE,
    Permission.PROCUREMENT_READ,
    Permission.PROCUREMENT_APPROVE,
    Permission.GRN_MANAGE,
    Permission.PRIVATE_INSURANCE_READ,
    Permission.PRIVATE_INSURANCE_MANAGE,
    Permission.PRIVATE_INSURANCE_AUTH,
    Permission.DEPARTMENT_MANAGE,
    Permission.ROSTER_MANAGE,
    Permission.ROSTER_READ,
    // SaaS Hospital Administration
    Permission.TENANT_CONFIG_MANAGE,
    Permission.TENANT_SUBSCRIPTION_READ,
    Permission.TENANT_SUBSCRIPTION_MANAGE,
    Permission.TENANT_USAGE_READ,
    Permission.TENANT_SUPPORT_CREATE,
    Permission.TENANT_SUPPORT_GRANT,
    Permission.TENANT_OFFBOARDING_REQUEST,
    Permission.TENANT_INVOICE_READ,
    Permission.TENANT_INVOICE_PAY,
  ],
  [UserRole.CLINICIAN]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_CONSENT_MANAGE,
    Permission.ENCOUNTER_CREATE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_UPDATE,
    Permission.ENCOUNTER_CLOSE,
    Permission.ENCOUNTER_REOPEN,
    Permission.TRIAGE_WRITE,
    Permission.CLINICAL_NOTE_WRITE,
    Permission.CLINICAL_NOTE_SIGN,
    Permission.CLINICAL_NOTE_AMEND,
    Permission.ALLERGY_MANAGE,
    Permission.CLINICAL_ORDER_READ,
    Permission.CLINICAL_ORDER_WRITE,
    Permission.CLINICAL_ORDER_AUTHORIZE,
    Permission.CLINICAL_ORDER_CANCEL,
    Permission.DIAGNOSIS_READ,
    Permission.DIAGNOSIS_WRITE,
    Permission.TERMINOLOGY_READ,
    Permission.BILL_VIEW,
    Permission.SHA_CLAIM_SUBMIT,
    Permission.SHA_CLAIM_READ,
    Permission.SHA_PREAUTH_MANAGE,
    Permission.SHA_CLAIM_RECONCILE,
    Permission.LAB_READ,
    Permission.LAB_RESULT_AUTHORIZE,
    Permission.PHARMACY_READ,
    Permission.MEDICATION_ADMINISTER,
    Permission.FHIR_VALIDATE,
    Permission.FHIR_EXCHANGE,
    Permission.FHIR_EXPORT,
    Permission.REGISTRY_SYNC_READ,
    // Phase 2 Hospital Ops - Clinician
    Permission.INPATIENT_ADMIT,
    Permission.INPATIENT_READ,
    Permission.INPATIENT_TRANSFER,
    Permission.INPATIENT_DISCHARGE,
    Permission.INPATIENT_CANCEL,
    Permission.BED_VIEW,
    Permission.THEATRE_BOOK,
    Permission.THEATRE_READ,
    Permission.THEATRE_UPDATE,
    Permission.THEATRE_CANCEL,
    Permission.THEATRE_CHECKLIST_SIGN,
    Permission.MATERNITY_READ,
    Permission.MATERNITY_WRITE,
    Permission.NEWBORN_REGISTER,
    Permission.NEWBORN_READ,
    Permission.RADIOLOGY_ORDER,
    Permission.RADIOLOGY_READ,
    Permission.RADIOLOGY_REPORT_WRITE,
    Permission.RADIOLOGY_REPORT_SIGN,
    Permission.RADIOLOGY_SPECIALIST_READ,
    Permission.REFERRAL_CREATE,
    Permission.REFERRAL_READ,
    Permission.REFERRAL_UPDATE,
    Permission.REFERRAL_CANCEL,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.ROSTER_READ,
    Permission.PRIVATE_INSURANCE_READ,
    Permission.PRIVATE_INSURANCE_AUTH,
  ],
  [UserRole.TRIAGE_NURSE]: [
    Permission.PATIENT_REGISTER,
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_CONSENT_MANAGE,
    Permission.ENCOUNTER_CREATE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_UPDATE,
    Permission.TRIAGE_WRITE,
    Permission.ALLERGY_MANAGE,
    Permission.CLINICAL_ORDER_READ,
    Permission.DIAGNOSIS_READ,
    Permission.TERMINOLOGY_READ,
    Permission.LAB_READ,
    Permission.PHARMACY_READ,
    Permission.MEDICATION_ADMINISTER,
    // Phase 2 Hospital Ops - Nurse
    Permission.INPATIENT_READ,
    Permission.INPATIENT_TRANSFER,
    Permission.BED_VIEW,
    Permission.MATERNITY_READ,
    Permission.MATERNITY_WRITE,
    Permission.NEWBORN_REGISTER,
    Permission.NEWBORN_READ,
    Permission.THEATRE_READ,
    Permission.THEATRE_CHECKLIST_SIGN,
    Permission.RADIOLOGY_READ,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_UPDATE,
    Permission.ROSTER_READ,
  ],
  [UserRole.LAB_TECH]: [
    Permission.PATIENT_READ,
    Permission.ENCOUNTER_READ,
    Permission.CLINICAL_ORDER_READ,
    Permission.TERMINOLOGY_READ,
    Permission.LAB_READ,
    Permission.LAB_WRITE,
    Permission.LAB_ORDER_EXECUTE,
    Permission.LAB_REJECT,
    Permission.PROCUREMENT_CREATE,
    Permission.PROCUREMENT_READ,
    Permission.GRN_MANAGE,
    Permission.ROSTER_READ,
  ],
  [UserRole.PHARMACIST]: [
    Permission.PATIENT_READ,
    Permission.ENCOUNTER_READ,
    Permission.CLINICAL_ORDER_READ,
    Permission.TERMINOLOGY_READ,
    Permission.PHARMACY_READ,
    Permission.PHARMACY_WRITE,
    Permission.PHARMACY_DISPENSE,
    Permission.PHARMACY_INVENTORY_MANAGE,
    Permission.PHARMACY_RETURN,
    Permission.INVENTORY_MANAGE,
    Permission.PROCUREMENT_CREATE,
    Permission.PROCUREMENT_READ,
    Permission.GRN_MANAGE,
    Permission.ROSTER_READ,
  ],
  [UserRole.BILLING_CLERK]: [
    Permission.PATIENT_READ,
    Permission.CLINICAL_ORDER_READ,
    Permission.DIAGNOSIS_READ,
    Permission.BILL_VIEW,
    Permission.BILL_WRITE,
    Permission.PAYMENT_PROCESS,
    Permission.SHA_CLAIM_SUBMIT,
    Permission.SHA_CLAIM_READ,
    Permission.SHA_PREAUTH_MANAGE,
    Permission.SHA_CLAIM_RECONCILE,
    Permission.KRA_ETIMS_SIGN,
    Permission.INPATIENT_READ,
    Permission.BED_VIEW,
    Permission.PRIVATE_INSURANCE_MANAGE,
    Permission.PRIVATE_INSURANCE_READ,
    Permission.PRIVATE_INSURANCE_AUTH,
    // SaaS Commercial Finance
    Permission.TENANT_INVOICE_READ,
    Permission.TENANT_INVOICE_PAY,
  ],
  [UserRole.FINANCE_USER]: [
    Permission.TENANT_SUBSCRIPTION_READ,
    Permission.TENANT_INVOICE_READ,
    Permission.TENANT_INVOICE_PAY,
    Permission.TENANT_USAGE_READ,
    Permission.TENANT_BILLING_RECONCILE,
    Permission.BILL_VIEW,
    Permission.PAYMENT_PROCESS,
    Permission.RECONCILIATION_MANAGE,
  ],
  [UserRole.RECORDS_OFFICER]: [
    Permission.PATIENT_REGISTER,
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_RECONCILE,
    Permission.PATIENT_CONSENT_MANAGE,
    Permission.ENCOUNTER_CREATE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_UPDATE,
    Permission.ENCOUNTER_REOPEN,
    Permission.CLINICAL_ORDER_READ,
    Permission.DIAGNOSIS_READ,
    Permission.TERMINOLOGY_READ,
    Permission.AUDIT_READ,
    Permission.REGISTRY_SYNC_TRIGGER,
    Permission.REGISTRY_SYNC_READ,
    Permission.INPATIENT_READ,
    Permission.BED_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.REFERRAL_READ,
    Permission.PRIVATE_INSURANCE_READ,
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const granted = ROLE_PERMISSIONS[role] || [];
  return granted.includes(permission);
}

export interface TenantContext {
  tenantId: string;
  facilityId?: string;
  facilityCode?: string; // KMFL code e.g. FID-XX-XXXXXX-X
  userId: string;
  sessionId?: string;
  userRole: UserRole;
  permissions: Permission[];
  puid?: string; // Healthcare Worker Registry ID
  isSuperAdmin: boolean;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantScopedEntity extends BaseEntity {
  tenantId: string;
}

export interface TenantJobPayload<T = unknown> {
  tenantId: string;
  facilityCode?: string;
  userId: string;
  isSuperAdmin?: boolean;
  jobType?: string;
  data: T;
  enqueuedAt?: string;
}

/**
 * Generates an isolated cache key scoped to a specific tenant.
 * Prevents cross-tenant Redis cache pollution.
 */
export function getTenantCacheKey(tenantId: string, resourceKey: string): string {
  if (!tenantId) {
    throw new Error('Tenant ID is required for generating a tenant-scoped cache key.');
  }
  return `tenant:${tenantId}:${resourceKey}`;
}

/**
 * Generates an isolated file storage path scoped to a specific tenant.
 * Prevents cross-tenant S3/local file access.
 */
export function getTenantStoragePath(tenantId: string, filename: string): string {
  if (!tenantId) {
    throw new Error('Tenant ID is required for generating a tenant-scoped storage path.');
  }
  // Sanitize path to prevent recursive directory traversal and null-byte injection
  let sanitized = filename.replace(/\0/g, '').replace(/\\/g, '/');
  while (sanitized.includes('..')) {
    sanitized = sanitized.replace(/\.\./g, '');
  }
  sanitized = sanitized.replace(/^\/+/, '').replace(/\/+/g, '/').trim();
  return `tenants/${tenantId}/${sanitized}`;
}

export enum AuditEventType {
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_MFA_CHALLENGE = 'AUTH_MFA_CHALLENGE',
  AUTH_MFA_VERIFIED = 'AUTH_MFA_VERIFIED',
  AUTH_MFA_FAILED = 'AUTH_MFA_FAILED',
  AUTH_SESSION_REVOKED = 'AUTH_SESSION_REVOKED',
  AUTH_PASSWORD_RESET_REQUESTED = 'AUTH_PASSWORD_RESET_REQUESTED',
  AUTH_PASSWORD_RESET_COMPLETED = 'AUTH_PASSWORD_RESET_COMPLETED',
  AUTHZ_FORBIDDEN_ACCESS = 'AUTHZ_FORBIDDEN_ACCESS',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_CREATED = 'USER_CREATED',
  TENANT_PROVISIONED = 'TENANT_PROVISIONED',
  CROSS_TENANT_VIOLATION_ATTEMPT = 'CROSS_TENANT_VIOLATION_ATTEMPT',
  STATE_TRANSITION_EXECUTED = 'STATE_TRANSITION_EXECUTED',
  STATE_TRANSITION_REJECTED = 'STATE_TRANSITION_REJECTED',
  INTEGRATION_CONFIG_UPDATED = 'INTEGRATION_CONFIG_UPDATED',
  EXTERNAL_REFERENCE_SYNCED = 'EXTERNAL_REFERENCE_SYNCED',
  BACKGROUND_JOB_ENQUEUED = 'BACKGROUND_JOB_ENQUEUED',
  BACKGROUND_JOB_COMPLETED = 'BACKGROUND_JOB_COMPLETED',
  BACKGROUND_JOB_FAILED = 'BACKGROUND_JOB_FAILED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_ACCESSED = 'FILE_ACCESSED',
  FEATURE_FLAG_UPDATED = 'FEATURE_FLAG_UPDATED',
  PATIENT_REGISTERED = 'PATIENT_REGISTERED',
  PATIENT_DEMOGRAPHICS_UPDATED = 'PATIENT_DEMOGRAPHICS_UPDATED',
  PATIENT_IDENTIFIER_ADDED = 'PATIENT_IDENTIFIER_ADDED',
  PATIENT_IDENTIFIER_REVOKED = 'PATIENT_IDENTIFIER_REVOKED',
  PATIENT_CONSENT_GRANTED = 'PATIENT_CONSENT_GRANTED',
  PATIENT_CONSENT_REVOKED = 'PATIENT_CONSENT_REVOKED',
  PATIENT_DUPLICATE_FLAGGED = 'PATIENT_DUPLICATE_FLAGGED',
  PATIENT_RECONCILED_MERGED = 'PATIENT_RECONCILED_MERGED',
  PATIENT_RECORD_ACCESSED = 'PATIENT_RECORD_ACCESSED',
  PATIENT_CR_SYNCED = 'PATIENT_CR_SYNCED',
  PATIENT_CR_SYNC_FAILED = 'PATIENT_CR_SYNC_FAILED',
  ENCOUNTER_CREATED = 'ENCOUNTER_CREATED',
  ENCOUNTER_STATUS_CHANGED = 'ENCOUNTER_STATUS_CHANGED',
  ENCOUNTER_CLOSED = 'ENCOUNTER_CLOSED',
  ENCOUNTER_REOPENED = 'ENCOUNTER_REOPENED',
  TRIAGE_VITALS_RECORDED = 'TRIAGE_VITALS_RECORDED',
  PATIENT_ALLERGY_RECORDED = 'PATIENT_ALLERGY_RECORDED',
  PATIENT_ALLERGY_UPDATED = 'PATIENT_ALLERGY_UPDATED',
  CLINICAL_NOTE_CREATED = 'CLINICAL_NOTE_CREATED',
  CLINICAL_NOTE_FINALIZED = 'CLINICAL_NOTE_FINALIZED',
  CLINICAL_NOTE_AMENDED = 'CLINICAL_NOTE_AMENDED',
  DIAGNOSIS_RECORDED = 'DIAGNOSIS_RECORDED',
  DIAGNOSIS_UPDATED = 'DIAGNOSIS_UPDATED',
  DIAGNOSIS_REMOVED = 'DIAGNOSIS_REMOVED',
  CLINICAL_ORDER_CREATED = 'CLINICAL_ORDER_CREATED',
  CLINICAL_ORDER_AUTHORIZED = 'CLINICAL_ORDER_AUTHORIZED',
  CLINICAL_ORDER_CANCELLED = 'CLINICAL_ORDER_CANCELLED',
  CLINICAL_ORDER_AMENDED = 'CLINICAL_ORDER_AMENDED',
  TERMINOLOGY_CATALOGUE_IMPORTED = 'TERMINOLOGY_CATALOGUE_IMPORTED',
  DUPLICATE_ORDER_OVERRIDDEN = 'DUPLICATE_ORDER_OVERRIDDEN',

  // Financial & Patient Billing Audits
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_FINALIZED = 'INVOICE_FINALIZED',
  INVOICE_CANCELLED = 'INVOICE_CANCELLED',
  INVOICE_ADJUSTMENT_REQUESTED = 'INVOICE_ADJUSTMENT_REQUESTED',
  INVOICE_ADJUSTMENT_APPROVED = 'INVOICE_ADJUSTMENT_APPROVED',
  INVOICE_ADJUSTMENT_REJECTED = 'INVOICE_ADJUSTMENT_REJECTED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_REVERSED = 'PAYMENT_REVERSED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  DAILY_RECONCILIATION_OPENED = 'DAILY_RECONCILIATION_OPENED',
  DAILY_RECONCILIATION_CLOSED = 'DAILY_RECONCILIATION_CLOSED',
  DAILY_RECONCILIATION_SUPERVISOR_SIGNOFF = 'DAILY_RECONCILIATION_SUPERVISOR_SIGNOFF',
  ETIMS_INVOICE_SIGNED = 'ETIMS_INVOICE_SIGNED',
  ETIMS_INVOICE_BUFFERED = 'ETIMS_INVOICE_BUFFERED',
  ETIMS_CREDIT_NOTE_ISSUED = 'ETIMS_CREDIT_NOTE_ISSUED',

  // SHA eClaims Integration Audits
  SHA_ELIGIBILITY_CHECKED = 'SHA_ELIGIBILITY_CHECKED',
  SHA_BENEFIT_VALIDATED = 'SHA_BENEFIT_VALIDATED',
  SHA_PREAUTH_REQUESTED = 'SHA_PREAUTH_REQUESTED',
  SHA_PREAUTH_APPROVED = 'SHA_PREAUTH_APPROVED',
  SHA_PREAUTH_REJECTED = 'SHA_PREAUTH_REJECTED',
  SHA_PREAUTH_CANCELLED = 'SHA_PREAUTH_CANCELLED',
  SHA_CLAIM_PREPARED = 'SHA_CLAIM_PREPARED',
  SHA_CLAIM_VALIDATED = 'SHA_CLAIM_VALIDATED',
  SHA_CLAIM_VALIDATION_FAILED = 'SHA_CLAIM_VALIDATION_FAILED',
  SHA_CLAIM_QUEUED = 'SHA_CLAIM_QUEUED',
  SHA_CLAIM_SUBMITTED = 'SHA_CLAIM_SUBMITTED',
  SHA_CLAIM_ACKNOWLEDGED = 'SHA_CLAIM_ACKNOWLEDGED',
  SHA_CLAIM_ACCEPTED = 'SHA_CLAIM_ACCEPTED',
  SHA_CLAIM_REJECTED = 'SHA_CLAIM_REJECTED',
  SHA_CLAIM_ADJUDICATED = 'SHA_CLAIM_ADJUDICATED',
  SHA_CLAIM_REMITTANCE_PROCESSED = 'SHA_CLAIM_REMITTANCE_PROCESSED',
  SHA_CLAIM_CORRECTION_PREPARED = 'SHA_CLAIM_CORRECTION_PREPARED',
  SHA_CLAIM_DISPUTED = 'SHA_CLAIM_DISPUTED',
  SHA_CLAIM_RECONCILED = 'SHA_CLAIM_RECONCILED',
  SHA_INPATIENT_DISCHARGE_SUBMITTED = 'SHA_INPATIENT_DISCHARGE_SUBMITTED',
  SHA_CALLBACK_RECEIVED = 'SHA_CALLBACK_RECEIVED',

  // FHIR R4 Interoperability Audits
  FHIR_RESOURCE_VALIDATED = 'FHIR_RESOURCE_VALIDATED',
  FHIR_BUNDLE_INGESTED = 'FHIR_BUNDLE_INGESTED',
  FHIR_BUNDLE_EXPORTED = 'FHIR_BUNDLE_EXPORTED',
  FHIR_EXCHANGE_DUPLICATE_DETECTED = 'FHIR_EXCHANGE_DUPLICATE_DETECTED',

  // Registry Synchronization & Integration Resilience Audits
  REGISTRY_SYNC_STARTED = 'REGISTRY_SYNC_STARTED',
  REGISTRY_SYNC_COMPLETED = 'REGISTRY_SYNC_COMPLETED',
  REGISTRY_SYNC_FAILED = 'REGISTRY_SYNC_FAILED',
  REGISTRY_RECORD_RECONCILED = 'REGISTRY_RECORD_RECONCILED',
  REGISTRY_RECORD_RETIRED = 'REGISTRY_RECORD_RETIRED',
  REGISTRY_CIRCUIT_STATE_CHANGED = 'REGISTRY_CIRCUIT_STATE_CHANGED',
  REGISTRY_DLQ_JOB_ENQUEUED = 'REGISTRY_DLQ_JOB_ENQUEUED',
  REGISTRY_DLQ_JOB_REPLAYED = 'REGISTRY_DLQ_JOB_REPLAYED',
  REGISTRY_PERSISTENT_FAILURE_ALERT = 'REGISTRY_PERSISTENT_FAILURE_ALERT',

  // Inpatient & Ward / Bed Operations
  INPATIENT_ADMITTED = 'INPATIENT_ADMITTED',
  INPATIENT_TRANSFERRED = 'INPATIENT_TRANSFERRED',
  INPATIENT_DISCHARGED = 'INPATIENT_DISCHARGED',
  INPATIENT_ADMISSION_CANCELLED = 'INPATIENT_ADMISSION_CANCELLED',
  INPATIENT_CANCELLED = 'INPATIENT_ADMISSION_CANCELLED',
  WARD_CREATED = 'WARD_CREATED',
  WARD_UPDATED = 'WARD_UPDATED',
  BED_CREATED = 'BED_CREATED',
  BED_CONFIGURED = 'BED_CREATED',
  BED_STATUS_CHANGED = 'BED_STATUS_CHANGED',

  // Operating Theatre & Procedure Operations
  THEATRE_CONFIGURED = 'THEATRE_CONFIGURED',
  THEATRE_BOOKING_CREATED = 'THEATRE_BOOKING_CREATED',
  THEATRE_BOOKING_UPDATED = 'THEATRE_BOOKING_UPDATED',
  THEATRE_BOOKING_CANCELLED = 'THEATRE_BOOKING_CANCELLED',
  WHO_SURGICAL_CHECKLIST_SIGNED = 'WHO_SURGICAL_CHECKLIST_SIGNED',
  SURGERY_COMPLETED = 'SURGERY_COMPLETED',

  // Maternity & Newborn Operations
  MATERNITY_DELIVERY_RECORDED = 'MATERNITY_DELIVERY_RECORDED',
  MATERNITY_DELIVERY_REGISTERED = 'MATERNITY_DELIVERY_RECORDED',
  NEWBORN_REGISTERED = 'NEWBORN_REGISTERED',
  PARTOGRAPH_RECORDED = 'PARTOGRAPH_RECORDED',

  // Radiology & Imaging Operations
  RADIOLOGY_ORDER_CREATED = 'RADIOLOGY_ORDER_CREATED',
  RADIOLOGY_ORDER_CANCELLED = 'RADIOLOGY_ORDER_CANCELLED',
  RADIOLOGY_REPORT_SIGNED = 'RADIOLOGY_REPORT_SIGNED',
  RADIOLOGY_REPORT_AMENDED = 'RADIOLOGY_REPORT_AMENDED',
  SPECIALIST_IMAGING_ACCESSED = 'SPECIALIST_IMAGING_ACCESSED',

  // Referrals & Counter-Referrals
  REFERRAL_DISPATCHED = 'REFERRAL_DISPATCHED',
  REFERRAL_ACCEPTED = 'REFERRAL_ACCEPTED',
  REFERRAL_REJECTED = 'REFERRAL_REJECTED',
  REFERRAL_STATUS_UPDATED = 'REFERRAL_STATUS_UPDATED',
  COUNTER_REFERRAL_COMPLETED = 'COUNTER_REFERRAL_COMPLETED',
  COUNTER_REFERRAL_RECEIVED = 'COUNTER_REFERRAL_COMPLETED',

  // Appointments & Scheduling
  APPOINTMENT_SCHEDULED = 'APPOINTMENT_SCHEDULED',
  APPOINTMENT_CHECKED_IN = 'APPOINTMENT_CHECKED_IN',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',

  // Procurement & Medical Supplies
  PROCUREMENT_ORDER_CREATED = 'PROCUREMENT_ORDER_CREATED',
  PROCUREMENT_ORDER_APPROVED = 'PROCUREMENT_ORDER_APPROVED',
  GOODS_RECEIVED_RECORDED = 'GOODS_RECEIVED_RECORDED',
  GRN_RECORDED = 'GOODS_RECEIVED_RECORDED',

  // Private Insurance
  INSURANCE_POLICY_REGISTERED = 'INSURANCE_POLICY_REGISTERED',
  PRIVATE_INSURANCE_POLICY_REGISTERED = 'INSURANCE_POLICY_REGISTERED',
  INSURANCE_PREAUTH_REQUESTED = 'INSURANCE_PREAUTH_REQUESTED',
  PRIVATE_INSURANCE_AUTH_REQUESTED = 'INSURANCE_PREAUTH_REQUESTED',
  INSURANCE_PREAUTH_ADJUDICATED = 'INSURANCE_PREAUTH_ADJUDICATED',

  // Rosters & Departmental Assignments
  DEPARTMENT_CREATED = 'DEPARTMENT_CREATED',
  STAFF_ROSTER_CREATED = 'STAFF_ROSTER_CREATED',
  ROSTER_PUBLISHED = 'ROSTER_PUBLISHED',
  STAFF_ROSTER_PUBLISHED = 'ROSTER_PUBLISHED',
  SHIFT_ASSIGNED = 'SHIFT_ASSIGNED',

  // Commercial SaaS Administration Audits
  TENANT_ONBOARDED = 'TENANT_ONBOARDED',
  FACILITY_CONFIGURED = 'FACILITY_CONFIGURED',
  SUBSCRIPTION_PLAN_CREATED = 'SUBSCRIPTION_PLAN_CREATED',
  SUBSCRIPTION_PLAN_UPDATED = 'SUBSCRIPTION_PLAN_UPDATED',
  SUBSCRIPTION_ACTIVATED = 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_UPGRADED = 'SUBSCRIPTION_UPGRADED',
  SUBSCRIPTION_DOWNGRADED = 'SUBSCRIPTION_DOWNGRADED',
  SUBSCRIPTION_SUSPENDED = 'SUBSCRIPTION_SUSPENDED',
  SUBSCRIPTION_REACTIVATED = 'SUBSCRIPTION_REACTIVATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  USAGE_METERED = 'USAGE_METERED',
  PLATFORM_INVOICE_ISSUED = 'PLATFORM_INVOICE_ISSUED',
  PLATFORM_INVOICE_PAID = 'PLATFORM_INVOICE_PAID',
  PLATFORM_PAYMENT_PROCESSED = 'PLATFORM_PAYMENT_PROCESSED',
  PLATFORM_PAYMENT_FAILED = 'PLATFORM_PAYMENT_FAILED',
  DUNNING_ACTION_EXECUTED = 'DUNNING_ACTION_EXECUTED',
  SUPPORT_CASE_CREATED = 'SUPPORT_CASE_CREATED',
  SUPPORT_CASE_UPDATED = 'SUPPORT_CASE_UPDATED',
  SUPPORT_CASE_RESOLVED = 'SUPPORT_CASE_RESOLVED',
  SUPPORT_ACCESS_GRANTED = 'SUPPORT_ACCESS_GRANTED',
  SUPPORT_ACCESS_REVOKED = 'SUPPORT_ACCESS_REVOKED',
  SUPPORT_ACCESS_UTILIZED = 'SUPPORT_ACCESS_UTILIZED',
  TENANT_OFFBOARDING_INITIATED = 'TENANT_OFFBOARDING_INITIATED',
  TENANT_OFFBOARDING_EXPORT_READY = 'TENANT_OFFBOARDING_EXPORT_READY',
  TENANT_OFFBOARDING_COMPLETED = 'TENANT_OFFBOARDING_COMPLETED',
}

// Result / Either Monad for resilient domain logic
export class Result<T, E = Error> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value);
  }

  static fail<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isSuccess(): boolean {
    return this._isSuccess;
  }

  isFailure(): boolean {
    return !this._isSuccess;
  }

  getValue(): T {
    if (!this._isSuccess) {
      throw new Error(`Cannot retrieve value from a failed Result: ${this._error}`);
    }
    return this._value as T;
  }

  getError(): E {
    if (this._isSuccess) {
      throw new Error('Cannot retrieve error from a successful Result');
    }
    return this._error as E;
  }
}

// Domain Errors
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';
  readonly statusCode = 422;
}

// ==========================================
// 1. PATIENT IDENTIFIERS
// ==========================================
export enum PatientIdentifierType {
  KENYA_NATIONAL_ID = 'KENYA_NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE',
  DHA_CRID = 'DHA_CRID', // Digital Health Agency Client Registry Identifier
  SHA_BENEFICIARY_ID = 'SHA_BENEFICIARY_ID', // Social Health Authority
  MRN = 'MRN', // Medical Record Number (Facility-specific)
  NEMIS = 'NEMIS', // National Education Management Information System
  ALIEN_ID = 'ALIEN_ID', // Refugee / Foreign national ID
  UPI = 'UPI', // Unique Personal Identifier
}

export enum PatientIdentifierStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  SECONDARY = 'SECONDARY',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum PatientGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export enum PatientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DECEASED = 'DECEASED',
  MERGED = 'MERGED',
}

export enum PatientIdentityStatus {
  LOCAL_ONLY = 'LOCAL_ONLY',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED_EXTERNAL = 'VERIFIED_EXTERNAL',
  RECONCILED = 'RECONCILED',
}

export enum ConsentType {
  GENERAL_DATA_PROCESSING = 'GENERAL_DATA_PROCESSING',
  HIE_SHR_SHARING = 'HIE_SHR_SHARING',
  RESEARCH_ANONYMIZED = 'RESEARCH_ANONYMIZED',
  SMS_NOTIFICATIONS = 'SMS_NOTIFICATIONS',
}

export enum ConsentStatus {
  GRANTED = 'GRANTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ConsentChannel {
  WRITTEN_FORM = 'WRITTEN_FORM',
  VERBAL_WITNESSED = 'VERBAL_WITNESSED',
  SMS_OTP = 'SMS_OTP',
  BIOMETRIC = 'BIOMETRIC',
}

export enum ReconciliationStatus {
  FLAGGED_DUPLICATE = 'FLAGGED_DUPLICATE',
  CONFIRMED_MERGED = 'CONFIRMED_MERGED',
  DISMISSED_FALSE_POSITIVE = 'DISMISSED_FALSE_POSITIVE',
}

export enum PatientAccessPurpose {
  CLINICAL_TREATMENT = 'CLINICAL_TREATMENT',
  TRIAGE = 'TRIAGE',
  BILLING = 'BILLING',
  ADMINISTRATION = 'ADMINISTRATION',
  AUDIT_REVIEW = 'AUDIT_REVIEW',
}

export enum PatientAccessType {
  VIEW_DEMOGRAPHICS = 'VIEW_DEMOGRAPHICS',
  VIEW_CLINICAL_HISTORY = 'VIEW_CLINICAL_HISTORY',
  EXPORT_RECORD = 'EXPORT_RECORD',
}

export interface EmergencyContactInfo {
  name: string;
  relationship: string;
  phone: string;
  phoneMasked?: string;
  alternativePhone?: string;
}

export interface PatientEntity extends TenantScopedEntity {
  primaryFacilityId: string;
  mrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  isDobEstimated: boolean;
  gender: PatientGender;
  bloodGroup?: string;
  phoneEncrypted?: string;
  phoneBlindIndex?: string;
  phoneMasked?: string;
  email?: string;
  physicalAddress?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  village?: string;
  postalCode?: string;
  nationality: string;
  maritalStatus?: string;
  emergencyContact?: EmergencyContactInfo;
  isEmergencyUnknown: boolean;
  status: PatientStatus;
  identityStatus: PatientIdentityStatus;
  dhaCrid?: string;
  shaNumber?: string;
  upi?: string;
  reconciledIntoPatientId?: string;
  reconciliationNotes?: string;
}

export interface PatientConsentEntity extends TenantScopedEntity {
  facilityId?: string;
  patientId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  channel: ConsentChannel;
  policyVersion: string;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revocationReason?: string;
  capturedById?: string;
  witnessName?: string;
  otpReference?: string;
}

export interface PatientReconciliationEntity extends TenantScopedEntity {
  sourcePatientId: string;
  targetPatientId: string;
  status: ReconciliationStatus;
  confidenceScore: number;
  matchReasons: string[];
  actionNotes?: string;
  reconciledById?: string;
  reconciledAt?: Date;
}

export interface PatientAccessLogEntity extends TenantScopedEntity {
  patientId: string;
  accessedById?: string;
  purpose: PatientAccessPurpose;
  accessType: PatientAccessType;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  accessedAt: Date;
}

export interface PatientIdentifierEntity extends TenantScopedEntity {
  facilityId?: string;
  patientId?: string;
  system: PatientIdentifierType;
  valueEncrypted: string;
  valueBlindIndex: string;
  valueMasked: string;
  status: PatientIdentifierStatus;
  isPrimary: boolean;
  patientAlias: string;
  issuingAuthority?: string;
  verificationStatus?: string;
  verificationMethod?: string;
  verifiedAt?: Date;
  verifiedBy?: string;
  notes?: string;
}

// ==========================================
// 1.5 ENCOUNTERS, TRIAGE, ALLERGIES & CLINICAL NOTES
// ==========================================
export enum EncounterType {
  WALK_IN = 'WALK_IN',
  APPOINTMENT = 'APPOINTMENT',
  EMERGENCY = 'EMERGENCY',
  REFERRAL = 'REFERRAL',
}

export enum EncounterStatus {
  PLANNED = 'PLANNED',
  ARRIVED = 'ARRIVED',
  TRIAGED = 'TRIAGED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REOPENED = 'REOPENED',
}

export enum TriagePriority {
  RESUSCITATION = 'RESUSCITATION', // Category 1 - Immediate (Red)
  EMERGENCY = 'EMERGENCY',         // Category 2 - Very Urgent (Orange)
  URGENT = 'URGENT',               // Category 3 - Urgent (Yellow)
  SEMI_URGENT = 'SEMI_URGENT',     // Category 4 - Standard (Green)
  NON_URGENT = 'NON_URGENT',       // Category 5 - Non-urgent (Blue)
}

export enum ServiceDepartment {
  OUTPATIENT = 'OUTPATIENT',
  EMERGENCY = 'EMERGENCY',
  PEDIATRICS = 'PEDIATRICS',
  MCH_FP = 'MCH_FP',
  DENTAL = 'DENTAL',
  EYE_CLINIC = 'EYE_CLINIC',
  SPECIALIST_CLINIC = 'SPECIALIST_CLINIC',
}

export enum AvpuLevel {
  ALERT = 'ALERT',
  VOICE = 'VOICE',
  PAIN = 'PAIN',
  UNRESPONSIVE = 'UNRESPONSIVE',
}

export enum ClinicalNoteType {
  CONSULTATION_NOTE = 'CONSULTATION_NOTE',
  PROGRESS_NOTE = 'PROGRESS_NOTE',
  PROCEDURE_NOTE = 'PROCEDURE_NOTE',
  EMERGENCY_NOTE = 'EMERGENCY_NOTE',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
}

export enum ClinicalNoteStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  AMENDED = 'AMENDED',
  CANCELLED = 'CANCELLED',
}

export enum AllergenType {
  MEDICATION = 'MEDICATION',
  FOOD = 'FOOD',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  BIOLOGICAL = 'BIOLOGICAL',
  OTHER = 'OTHER',
}

export enum AllergySeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  LIFE_THREATENING = 'LIFE_THREATENING',
}

export enum AllergyClinicalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  RESOLVED = 'RESOLVED',
}

export enum AllergyVerificationStatus {
  CONFIRMED = 'CONFIRMED',
  SUSPECTED = 'SUSPECTED',
  REFUTED = 'REFUTED',
}

export interface EncounterEntity extends TenantScopedEntity {
  facilityId: string;
  patientId: string;
  practitionerId?: string;
  encounterNumber: string;
  encounterType: EncounterType;
  serviceDepartment: ServiceDepartment;
  status: EncounterStatus;
  priority: TriagePriority;
  reasonForVisit?: string;
  startedAt: Date;
  endedAt?: Date;
  reopenedAt?: Date;
  reopenedById?: string;
  reopeningReason?: string;
  version: number;
}

export interface TriageVitalsEntity extends TenantScopedEntity {
  facilityId?: string;
  encounterId: string;
  patientId: string;
  assessedById: string;
  systolicBp?: number; // mmHg
  diastolicBp?: number; // mmHg
  heartRate?: number; // bpm
  respiratoryRate?: number; // /min
  temperature?: number; // °C
  oxygenSaturation?: number; // %
  weightKg?: number; // kg
  heightCm?: number; // cm
  bmi?: number; // kg/m^2
  bloodGlucose?: number; // mmol/L
  avpuLevel?: AvpuLevel;
  triagePriority: TriagePriority;
  triageNotes?: string;
  assessedAt: Date;
}

export interface PatientAllergyEntity extends TenantScopedEntity {
  patientId: string;
  encounterId?: string;
  recordedById?: string;
  allergen: string;
  allergenType: AllergenType;
  severity: AllergySeverity;
  reaction?: string;
  clinicalStatus: AllergyClinicalStatus;
  verificationStatus: AllergyVerificationStatus;
  onsetAgeYears?: number;
  notes?: string;
  recordedAt: Date;
}

export interface ClinicalNoteEntity extends TenantScopedEntity {
  facilityId?: string;
  encounterId: string;
  patientId: string;
  authorId: string;
  noteType: ClinicalNoteType;
  status: ClinicalNoteStatus;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  reviewOfSystems?: string;
  physicalExamination?: string;
  assessment: string;
  plan: string;
  entryTime: Date;
  effectiveTime: Date;
  finalizedAt?: Date;
  finalizedById?: string;
  version: number;
}

export interface ClinicalNoteAmendmentEntity extends TenantScopedEntity {
  noteId: string;
  amendedById: string;
  reason: string;
  amendmentText: string;
  amendedAt: Date;
}

/**
 * Calculates Body Mass Index (BMI) from weight (kg) and height (cm).
 * Formula: weight (kg) / (height (m) ^ 2)
 */
export function calculateBmi(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm || heightCm <= 0 || weightKg <= 0) {
    return undefined;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

// ==========================================
// 1.5 CLINICAL TERMINOLOGY, DIAGNOSES & ORDERS
// ==========================================

export enum CodingSystem {
  ICD_11_MMS = 'ICD_11_MMS',
  ICD_10 = 'ICD_10',
  LOINC = 'LOINC',
  SNOMED_CT = 'SNOMED_CT',
  KENYA_EML = 'KENYA_EML',
  WHO_ATC = 'WHO_ATC',
  KENYA_MOH_LAB = 'KENYA_MOH_LAB',
}

export enum TerminologyCatalogueStatus {
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  RETIRED = 'RETIRED',
}

export interface TerminologyCatalogueEntity {
  id: string;
  system: CodingSystem;
  version: string;
  name: string;
  releaseDate?: string;
  authority: string;
  status: TerminologyCatalogueStatus;
  conceptCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TerminologyConceptEntity {
  id: string;
  catalogueId: string;
  code: string;
  display: string;
  definition?: string;
  system: CodingSystem;
  version: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  isActive: boolean;
  synonyms?: string[];
  parentCode?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum DiagnosisType {
  WORKING = 'WORKING',
  PRESUMPTIVE = 'PRESUMPTIVE',
  CONFIRMED = 'CONFIRMED',
  DIFFERENTIAL = 'DIFFERENTIAL',
  DISCHARGE = 'DISCHARGE',
}

export enum DiagnosisClinicalStatus {
  ACTIVE = 'ACTIVE',
  RECURRENCE = 'RECURRENCE',
  RELAPSE = 'RELAPSE',
  INACTIVE = 'INACTIVE',
  REMISSION = 'REMISSION',
  RESOLVED = 'RESOLVED',
}

export enum DiagnosisVerificationStatus {
  PROVISIONAL = 'PROVISIONAL',
  DIFFERENTIAL = 'DIFFERENTIAL',
  CONFIRMED = 'CONFIRMED',
  REFUTED = 'REFUTED',
  ENTERED_IN_ERROR = 'ENTERED_IN_ERROR',
}

export enum DiagnosisCertainty {
  SUSPECTED = 'SUSPECTED',
  PROBABLE = 'PROBABLE',
  CONFIRMED = 'CONFIRMED',
}

export interface DiagnosisEntity extends TenantScopedEntity {
  facilityId?: string;
  encounterId: string;
  patientId: string;
  recordedById: string;
  code: string;
  codingSystem: CodingSystem;
  display: string;
  diagnosisType: DiagnosisType;
  clinicalStatus: DiagnosisClinicalStatus;
  verificationStatus: DiagnosisVerificationStatus;
  certainty?: DiagnosisCertainty;
  isPrimary: boolean;
  onsetDate?: Date;
  notes?: string;
  recordedAt: Date;
}

export enum ClinicalOrderType {
  MEDICATION_REQUEST = 'MEDICATION_REQUEST',
  LAB_SERVICE_REQUEST = 'LAB_SERVICE_REQUEST',
  RADIOLOGY_SERVICE_REQUEST = 'RADIOLOGY_SERVICE_REQUEST',
  PROCEDURE_REQUEST = 'PROCEDURE_REQUEST',
}

export enum ClinicalOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ACTIVE = 'ACTIVE',
  AUTHORIZED = 'AUTHORIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  AMENDED = 'AMENDED',
}

export enum ClinicalOrderPriority {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  STAT = 'STAT',
  ASAP = 'ASAP',
}

export enum ClinicalOrderIntent {
  ORDER = 'ORDER',
  PROPOSAL = 'PROPOSAL',
  PLAN = 'PLAN',
  ORIGINAL_ORDER = 'ORIGINAL_ORDER',
}

export enum MedicationRoute {
  ORAL = 'ORAL',
  INTRAVENOUS = 'INTRAVENOUS',
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  SUBCUTANEOUS = 'SUBCUTANEOUS',
  TOPICAL = 'TOPICAL',
  INHALATION = 'INHALATION',
  RECTAL = 'RECTAL',
  OPHTHALMIC = 'OPHTHALMIC',
  OTIC = 'OTIC',
  SUBLINGUAL = 'SUBLINGUAL',
}

export enum MedicationFrequency {
  QD = 'QD',
  BID = 'BID',
  TID = 'TID',
  QID = 'QID',
  Q4H = 'Q4H',
  Q6H = 'Q6H',
  Q8H = 'Q8H',
  Q12H = 'Q12H',
  PRN = 'PRN',
  STAT = 'STAT',
  ONCE_WEEKLY = 'ONCE_WEEKLY',
}

export enum MedicationDurationUnit {
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  DOSES = 'DOSES',
}

export enum MedicationQuantityUnit {
  TABLETS = 'TABLETS',
  CAPSULES = 'CAPSULES',
  VIALS = 'VIALS',
  BOTTLES = 'BOTTLES',
  AMPOULES = 'AMPOULES',
  TUBES = 'TUBES',
  BLISTERS = 'BLISTERS',
  MLS = 'MLS',
}

export enum ServiceCategory {
  LABORATORY = 'LABORATORY',
  RADIOLOGY = 'RADIOLOGY',
  CARDIOLOGY = 'CARDIOLOGY',
  PROCEDURE = 'PROCEDURE',
  CONSULTATION = 'CONSULTATION',
}

export enum SpecimenType {
  WHOLE_BLOOD = 'WHOLE_BLOOD',
  SERUM = 'SERUM',
  PLASMA = 'PLASMA',
  URINE = 'URINE',
  SPUTUM = 'SPUTUM',
  STOOL = 'STOOL',
  SWAB = 'SWAB',
  CSF = 'CSF',
  PLEURAL_FLUID = 'PLEURAL_FLUID',
  BIOPSY_TISSUE = 'BIOPSY_TISSUE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export interface ClinicalOrderEntity extends TenantScopedEntity {
  facilityId: string;
  encounterId: string;
  patientId: string;
  orderingPractitionerId: string;
  orderNumber: string;
  orderType: ClinicalOrderType;
  status: ClinicalOrderStatus;
  priority: ClinicalOrderPriority;
  intent: ClinicalOrderIntent;
  clinicalIndication?: string;
  notes?: string;
  orderedAt: Date;
  authorizedById?: string;
  authorizedAt?: Date;
  cancelledById?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  amendmentReason?: string;
  amendedById?: string;
  amendedAt?: Date;
  supersededOrderId?: string;
  duplicateHash?: string;
  version: number;
}

export interface MedicationRequestEntity extends TenantScopedEntity {
  orderId: string;
  patientId: string;
  medicationCode: string;
  medicationName: string;
  codingSystem: CodingSystem;
  dosage: string;
  dosageUnit: string;
  route: MedicationRoute;
  frequency: MedicationFrequency;
  durationValue: number;
  durationUnit: MedicationDurationUnit;
  totalQuantity: number;
  quantityUnit: MedicationQuantityUnit;
  instructions?: string;
  refillsAllowed: number;
  isPrn: boolean;
  prnReason?: string;
  substitutionAllowed: boolean;
}

export interface ServiceRequestEntity extends TenantScopedEntity {
  orderId: string;
  patientId: string;
  serviceCategory: ServiceCategory;
  serviceCode: string;
  serviceName: string;
  codingSystem: CodingSystem;
  specimenType?: SpecimenType;
  bodySite?: string;
  clinicalNotes?: string;
  urgency: ClinicalOrderPriority;
}

export function canTransitionOrderStatus(current: ClinicalOrderStatus, next: ClinicalOrderStatus): boolean {
  if (current === next) return true;
  const transitions: Record<ClinicalOrderStatus, ClinicalOrderStatus[]> = {
    [ClinicalOrderStatus.DRAFT]: [ClinicalOrderStatus.SUBMITTED, ClinicalOrderStatus.ACTIVE, ClinicalOrderStatus.CANCELLED],
    [ClinicalOrderStatus.SUBMITTED]: [ClinicalOrderStatus.AUTHORIZED, ClinicalOrderStatus.ACTIVE, ClinicalOrderStatus.CANCELLED],
    [ClinicalOrderStatus.ACTIVE]: [ClinicalOrderStatus.AUTHORIZED, ClinicalOrderStatus.IN_PROGRESS, ClinicalOrderStatus.COMPLETED, ClinicalOrderStatus.CANCELLED, ClinicalOrderStatus.SUSPENDED, ClinicalOrderStatus.AMENDED],
    [ClinicalOrderStatus.AUTHORIZED]: [ClinicalOrderStatus.IN_PROGRESS, ClinicalOrderStatus.COMPLETED, ClinicalOrderStatus.CANCELLED, ClinicalOrderStatus.SUSPENDED, ClinicalOrderStatus.AMENDED],
    [ClinicalOrderStatus.IN_PROGRESS]: [ClinicalOrderStatus.COMPLETED, ClinicalOrderStatus.CANCELLED, ClinicalOrderStatus.SUSPENDED],
    [ClinicalOrderStatus.SUSPENDED]: [ClinicalOrderStatus.ACTIVE, ClinicalOrderStatus.AUTHORIZED, ClinicalOrderStatus.CANCELLED],
    [ClinicalOrderStatus.COMPLETED]: [],
    [ClinicalOrderStatus.CANCELLED]: [],
    [ClinicalOrderStatus.AMENDED]: [],
  };
  return transitions[current]?.includes(next) ?? false;
}

// ==========================================
// 1.6 LABORATORY & DIAGNOSTIC SERVICES
// ==========================================

export enum LabDepartment {
  HEMATOLOGY = 'HEMATOLOGY',
  CLINICAL_CHEMISTRY = 'CLINICAL_CHEMISTRY',
  MICROBIOLOGY = 'MICROBIOLOGY',
  PARASITOLOGY = 'PARASITOLOGY',
  SEROLOGY = 'SEROLOGY',
  HISTOPATHOLOGY = 'HISTOPATHOLOGY',
  BLOOD_TRANSFUSION = 'BLOOD_TRANSFUSION',
  MOLECULAR_DIAGNOSTICS = 'MOLECULAR_DIAGNOSTICS',
  URINALYSIS = 'URINALYSIS',
}

export enum SpecimenStatus {
  PENDING_COLLECTION = 'PENDING_COLLECTION',
  COLLECTED = 'COLLECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED_IN_LAB = 'RECEIVED_IN_LAB',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum SpecimenRejectionReason {
  HEMOLYZED = 'HEMOLYZED',
  CLOTTED = 'CLOTTED',
  INSUFFICIENT_VOLUME = 'INSUFFICIENT_VOLUME',
  INCORRECT_CONTAINER = 'INCORRECT_CONTAINER',
  LEAKING_CONTAINER = 'LEAKING_CONTAINER',
  UNLABELED_SPECIMEN = 'UNLABELED_SPECIMEN',
  MISLABELED_SPECIMEN = 'MISLABELED_SPECIMEN',
  EXPIRED_TRANSPORT_MEDIA = 'EXPIRED_TRANSPORT_MEDIA',
  CONTAMINATED_SPECIMEN = 'CONTAMINATED_SPECIMEN',
  CLINICALLY_INAPPROPRIATE = 'CLINICALLY_INAPPROPRIATE',
}

export enum ContainerType {
  EDTA_PURPLE_TOP = 'EDTA_PURPLE_TOP',
  EDTA_TUBE_LAVENDER = 'EDTA_TUBE_LAVENDER',
  SST_GOLD_TOP = 'SST_GOLD_TOP',
  SST_TUBE_GOLD = 'SST_TUBE_GOLD',
  PLAIN_RED_TOP = 'PLAIN_RED_TOP',
  CITRATE_BLUE_TOP = 'CITRATE_BLUE_TOP',
  FLUORIDE_GREY_TOP = 'FLUORIDE_GREY_TOP',
  FLUORIDE_OXALATE_TUBE_GRAY = 'FLUORIDE_OXALATE_TUBE_GRAY',
  STERILE_CUP = 'STERILE_CUP',
  URINE_CONTAINER_STERILE = 'URINE_CONTAINER_STERILE',
  SWAB_TRANSPORT_TUBE = 'SWAB_TRANSPORT_TUBE',
  BLOOD_CULTURE_BOTTLE = 'BLOOD_CULTURE_BOTTLE',
}

export enum LabAbnormalFlag {
  NORMAL = 'NORMAL',
  ABNORMAL = 'ABNORMAL',
  LOW = 'LOW',
  HIGH = 'HIGH',
  CRITICAL_LOW = 'CRITICAL_LOW',
  CRITICAL_HIGH = 'CRITICAL_HIGH',
}

export enum LabResultStatus {
  PRELIMINARY = 'PRELIMINARY',
  VERIFIED = 'VERIFIED',
  FINAL = 'FINAL',
  AMENDED = 'AMENDED',
  CORRECTED = 'CORRECTED',
  ENTERED_IN_ERROR = 'ENTERED_IN_ERROR',
}

export enum DiagnosticReportStatus {
  REGISTERED = 'REGISTERED',
  PARTIAL = 'PARTIAL',
  PRELIMINARY = 'PRELIMINARY',
  FINAL = 'FINAL',
  AMENDED = 'AMENDED',
  CORRECTED = 'CORRECTED',
  CANCELLED = 'CANCELLED',
}

export enum LabConsumableCategory {
  VACUTAINER = 'VACUTAINER',
  RAPID_TEST_KIT = 'RAPID_TEST_KIT',
  RAPID_TEST_CASSETTE = 'RAPID_TEST_CASSETTE',
  REAGENT = 'REAGENT',
  PPE = 'PPE',
  CONSUMABLE = 'CONSUMABLE',
}

export enum DeductionReason {
  SPECIMEN_COLLECTION = 'SPECIMEN_COLLECTION',
  ANALYSIS = 'ANALYSIS',
  RECOLLECTION_WASTAGE = 'RECOLLECTION_WASTAGE',
  QUALITY_CONTROL = 'QUALITY_CONTROL',
}

export interface LabTestCatalogEntity {
  id: string;
  tenantId?: string;
  testCode: string;
  codingSystem: string;
  testName: string;
  department: LabDepartment;
  specimenType: SpecimenType;
  containerType: ContainerType;
  targetTatMinutes: number;
  methodology?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabReferenceRangeEntity {
  id: string;
  testCatalogId: string;
  gender: 'MALE' | 'FEMALE' | 'ANY';
  ageMinDays: number;
  ageMaxDays: number;
  lowNumeric?: number;
  highNumeric?: number;
  criticalLowNumeric?: number;
  criticalHighNumeric?: number;
  unit: string;
  textualRange?: string;
  source: string;
  sourceVersion: string;
  effectiveDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabSpecimenEntity extends TenantScopedEntity {
  facilityId: string;
  orderId: string;
  patientId: string;
  accessionNumber: string;
  barcode: string;
  specimenType: SpecimenType;
  containerType: ContainerType;
  status: SpecimenStatus;
  collectedById?: string;
  collectedAt?: Date;
  receivedById?: string;
  receivedAt?: Date;
  rejectionReason?: SpecimenRejectionReason;
  rejectedById?: string;
  rejectedAt?: Date;
  rejectionNotes?: string;
  recollectionRequired: boolean;
  recollectionSpecimenId?: string;
  collectionSite?: string;
  volumeMl?: number;
  notes?: string;
}

export interface LabResultEntity extends TenantScopedEntity {
  facilityId: string;
  specimenId: string;
  orderId: string;
  testCatalogId: string;
  testCode: string;
  testName: string;
  department: LabDepartment;
  numericValue?: number;
  textValue?: string;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  referenceRangeText?: string;
  referenceSource?: string;
  referenceSourceVersion?: string;
  abnormalFlag: LabAbnormalFlag;
  technologistId: string;
  enteredAt: Date;
  verifiedById?: string;
  verifiedAt?: Date;
  verifierRole?: string;
  verificationSignature?: string;
  status: LabResultStatus;
  correctedFromId?: string;
  correctionReason?: string;
  notes?: string;
}

export interface DiagnosticReportEntity extends TenantScopedEntity {
  facilityId: string;
  orderId: string;
  encounterId: string;
  patientId: string;
  reportNumber: string;
  status: DiagnosticReportStatus;
  title: string;
  conclusion?: string;
  issuedAt: Date;
  performerId: string;
  authorizerId?: string;
  authorizedAt?: Date;
  authorizationSignature?: string;
  amendedFromId?: string;
  amendmentReason?: string;
  resultsSummary?: string;
}

export interface LabConsumableEntity extends TenantScopedEntity {
  facilityId: string;
  itemCode: string;
  name: string;
  category: LabConsumableCategory;
  quantityOnHand: number;
  reorderLevel: number;
  unitOfMeasure: string;
  lotNumber?: string;
  expiryDate?: Date;
}

export interface LabConsumableDeductionEntity extends TenantScopedEntity {
  facilityId: string;
  consumableId: string;
  specimenId?: string;
  orderId?: string;
  quantityDeducted: number;
  reason: DeductionReason;
  deductedById: string;
  deductedAt: Date;
}

export function canTransitionSpecimenStatus(current: SpecimenStatus, next: SpecimenStatus): boolean {
  if (current === next) return false;
  const transitions: Record<SpecimenStatus, SpecimenStatus[]> = {
    [SpecimenStatus.PENDING_COLLECTION]: [SpecimenStatus.COLLECTED, SpecimenStatus.REJECTED],
    [SpecimenStatus.COLLECTED]: [SpecimenStatus.IN_TRANSIT, SpecimenStatus.RECEIVED_IN_LAB, SpecimenStatus.REJECTED],
    [SpecimenStatus.IN_TRANSIT]: [SpecimenStatus.RECEIVED_IN_LAB, SpecimenStatus.REJECTED],
    [SpecimenStatus.RECEIVED_IN_LAB]: [SpecimenStatus.PROCESSING, SpecimenStatus.REJECTED],
    [SpecimenStatus.PROCESSING]: [SpecimenStatus.COMPLETED, SpecimenStatus.REJECTED],
    [SpecimenStatus.COMPLETED]: [],
    [SpecimenStatus.REJECTED]: [],
  };
  return transitions[current]?.includes(next) ?? false;
}

export function canTransitionReportStatus(current: DiagnosticReportStatus, next: DiagnosticReportStatus): boolean {
  if (current === next) return true;
  const transitions: Record<DiagnosticReportStatus, DiagnosticReportStatus[]> = {
    [DiagnosticReportStatus.REGISTERED]: [DiagnosticReportStatus.PARTIAL, DiagnosticReportStatus.PRELIMINARY, DiagnosticReportStatus.FINAL, DiagnosticReportStatus.CANCELLED],
    [DiagnosticReportStatus.PARTIAL]: [DiagnosticReportStatus.PRELIMINARY, DiagnosticReportStatus.FINAL, DiagnosticReportStatus.CANCELLED],
    [DiagnosticReportStatus.PRELIMINARY]: [DiagnosticReportStatus.FINAL, DiagnosticReportStatus.CANCELLED],
    [DiagnosticReportStatus.FINAL]: [DiagnosticReportStatus.AMENDED, DiagnosticReportStatus.CORRECTED],
    [DiagnosticReportStatus.AMENDED]: [DiagnosticReportStatus.AMENDED, DiagnosticReportStatus.CORRECTED],
    [DiagnosticReportStatus.CORRECTED]: [],
    [DiagnosticReportStatus.CANCELLED]: [],
  };
  return transitions[current]?.includes(next) ?? false;
}

export function evaluateAbnormalFlag(params: {
  numericValue?: number;
  rangeLow?: number;
  rangeHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  textValue?: string;
  expectedText?: string;
}): LabAbnormalFlag {
  const { numericValue, rangeLow, rangeHigh, criticalLow, criticalHigh, textValue, expectedText } = params;

  if (numericValue !== undefined && numericValue !== null && !isNaN(numericValue)) {
    if (criticalLow !== undefined && criticalLow !== null && numericValue <= criticalLow) {
      return LabAbnormalFlag.CRITICAL_LOW;
    }
    if (criticalHigh !== undefined && criticalHigh !== null && numericValue >= criticalHigh) {
      return LabAbnormalFlag.CRITICAL_HIGH;
    }
    if (rangeLow !== undefined && rangeLow !== null && numericValue < rangeLow) {
      return LabAbnormalFlag.LOW;
    }
    if (rangeHigh !== undefined && rangeHigh !== null && numericValue > rangeHigh) {
      return LabAbnormalFlag.HIGH;
    }
    return LabAbnormalFlag.NORMAL;
  }

  if (textValue && expectedText) {
    const normText = textValue.trim().toLowerCase();
    const normExpected = expectedText.trim().toLowerCase();
    if (normText === normExpected) {
      return LabAbnormalFlag.NORMAL;
    }
    if (normText.includes('positive') || normText.includes('reactive') || normText.includes('abnormal')) {
      return LabAbnormalFlag.CRITICAL_HIGH;
    }
    return LabAbnormalFlag.ABNORMAL;
  }

  return LabAbnormalFlag.NORMAL;
}

export function calculateTurnaroundTimes(timestamps: {
  orderedAt: Date | string;
  collectedAt?: Date | string;
  receivedAt?: Date | string;
  resultedAt?: Date | string;
  authorizedAt?: Date | string;
}): {
  orderToCollectionMinutes?: number;
  collectionToReceiptMinutes?: number;
  receiptToResultMinutes?: number;
  resultToAuthorizationMinutes?: number;
  totalTurnaroundMinutes?: number;
} {
  const toMs = (d?: Date | string) => (d ? new Date(d).getTime() : undefined);
  const orderedMs = toMs(timestamps.orderedAt);
  const collectedMs = toMs(timestamps.collectedAt);
  const receivedMs = toMs(timestamps.receivedAt);
  const resultedMs = toMs(timestamps.resultedAt);
  const authorizedMs = toMs(timestamps.authorizedAt);

  const calcDiffMins = (start?: number, end?: number) => {
    if (start === undefined || end === undefined || end < start) return undefined;
    return Math.round((end - start) / (1000 * 60));
  };

  return {
    orderToCollectionMinutes: calcDiffMins(orderedMs, collectedMs),
    collectionToReceiptMinutes: calcDiffMins(collectedMs, receivedMs),
    receiptToResultMinutes: calcDiffMins(receivedMs, resultedMs),
    resultToAuthorizationMinutes: calcDiffMins(resultedMs, authorizedMs),
    totalTurnaroundMinutes: calcDiffMins(orderedMs, authorizedMs || resultedMs),
  };
}

// ==========================================
// 2. INTEGRATION CONFIGURATIONS
// ==========================================
export enum IntegrationSystemType {
  DHA_HIE = 'DHA_HIE',
  SHA_ECCIF = 'SHA_ECCIF',
  KRA_ETIMS = 'KRA_ETIMS',
  SMS_GATEWAY = 'SMS_GATEWAY',
  CLAIM_SWITCH = 'CLAIM_SWITCH',
}

export enum IntegrationEnvironment {
  MOCK = 'MOCK',
  SANDBOX = 'SANDBOX',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

export enum IntegrationAuthType {
  MTLS = 'MTLS',
  OAUTH2 = 'OAUTH2',
  API_KEY = 'API_KEY',
  BEARER = 'BEARER',
}

export interface IntegrationConfigEntity extends TenantScopedEntity {
  facilityId?: string;
  systemType: IntegrationSystemType;
  environment: IntegrationEnvironment;
  endpointUrl: string;
  authType: IntegrationAuthType;
  credentialsEncrypted?: string;
  isActive: boolean;
  rateLimitPerMinute: number;
  timeoutMs: number;
  settings?: Record<string, unknown>;
}

// ==========================================
// 3. EXTERNAL REFERENCES
// ==========================================
export enum InternalEntityType {
  PATIENT = 'PATIENT',
  ENCOUNTER = 'ENCOUNTER',
  CLAIM = 'CLAIM',
  INVOICE = 'INVOICE',
  ORDER = 'ORDER',
  PRACTITIONER = 'PRACTITIONER',
}

export enum ExternalSystem {
  DHA_CR = 'DHA_CR',
  DHA_SHR = 'DHA_SHR',
  SHA_ECCIF = 'SHA_ECCIF',
  KRA_ETIMS = 'KRA_ETIMS',
  KMFL = 'KMFL',
}

export enum ExternalReferenceStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  OUTDATED = 'OUTDATED',
}

export interface ExternalReferenceEntity extends TenantScopedEntity {
  facilityId?: string;
  internalEntityType: InternalEntityType;
  internalEntityId: string;
  externalSystem: ExternalSystem;
  externalId: string;
  status: ExternalReferenceStatus;
  syncAttempts: number;
  lastSyncedAt?: Date;
  responseMetadata?: Record<string, unknown>;
}

// ==========================================
// 4. BACKGROUND JOBS & EXECUTIONS
// ==========================================
export enum JobQueueName {
  DEFAULT = 'default',
  CLAIMS = 'claims-outbound',
  HIE = 'hie-outbound',
  NOTIFICATIONS = 'notifications',
  REPORTS = 'reports',
  REGISTRY_SYNC = 'registry-sync',
  DEAD_LETTER = 'dead-letter-queue',
}

export enum JobType {
  SHA_CLAIM_DISPATCH = 'SHA_CLAIM_DISPATCH',
  DHA_SHR_BUNDLE_SYNC = 'DHA_SHR_BUNDLE_SYNC',
  SMS_DISPATCH = 'SMS_DISPATCH',
  REPORT_GENERATION = 'REPORT_GENERATION',
  AUDIT_DIGEST_VERIFICATION = 'AUDIT_DIGEST_VERIFICATION',
  CLIENT_REGISTRY_SYNC = 'CLIENT_REGISTRY_SYNC',
  FACILITY_REGISTRY_SYNC = 'FACILITY_REGISTRY_SYNC',
  HEALTH_WORKER_REGISTRY_SYNC = 'HEALTH_WORKER_REGISTRY_SYNC',
  TERMINOLOGY_CATALOGUE_SYNC = 'TERMINOLOGY_CATALOGUE_SYNC',
}

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD_LETTER = 'DEAD_LETTER',
  DISCARDED = 'DISCARDED',
}

export enum RegistrySyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  STALE = 'STALE',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
  RETIRED = 'RETIRED',
  UNVERIFIED_OFFLINE = 'UNVERIFIED_OFFLINE',
}

export enum RegistryType {
  CLIENT_REGISTRY = 'CLIENT_REGISTRY',
  FACILITY_REGISTRY = 'FACILITY_REGISTRY',
  HEALTH_WORKER_REGISTRY = 'HEALTH_WORKER_REGISTRY',
  TERMINOLOGY_CATALOGUE = 'TERMINOLOGY_CATALOGUE',
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export enum SyncTriggerType {
  SCHEDULED = 'SCHEDULED',
  MANUAL = 'MANUAL',
  EVENT_DRIVEN = 'EVENT_DRIVEN',
  RECONCILIATION = 'RECONCILIATION',
}

export interface JobExecutionEntity extends TenantScopedEntity {
  queueName: JobQueueName;
  jobType: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  correlationId: string;
  attempts: number;
  maxAttempts: number;
  errorDetails?: string;
  lockedAt?: Date;
  lockedBy?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ==========================================
// 5. FILE METADATA & STORAGE
// ==========================================
export enum StorageDriver {
  S3 = 'S3',
  MINIO = 'MINIO',
  LOCAL = 'LOCAL',
}

export enum FileAccessLevel {
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  PUBLIC_TENANT = 'PUBLIC_TENANT',
}

export enum FileEntityType {
  PATIENT_DOCUMENT = 'PATIENT_DOCUMENT',
  LAB_REPORT = 'LAB_REPORT',
  PRESCRIPTION_SCAN = 'PRESCRIPTION_SCAN',
  INSURANCE_CARD = 'INSURANCE_CARD',
  EXPORT = 'EXPORT',
}

export interface FileMetadataEntity extends TenantScopedEntity {
  facilityId?: string;
  storageDriver: StorageDriver;
  storageKey: string;
  bucketName: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
  entityType: FileEntityType;
  entityId: string;
  accessLevel: FileAccessLevel;
  isEncrypted: boolean;
  uploadedBy: string;
}

// ==========================================
// 6. APPLICATION CONFIGURATION & FEATURE FLAGS
// ==========================================
export enum ConfigValueType {
  BOOLEAN = 'BOOLEAN',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  JSON = 'JSON',
}

export interface AppConfigurationEntity extends BaseEntity {
  tenantId?: string; // Null indicates global platform default
  facilityId?: string;
  configKey: string;
  configValue: string;
  valueType: ConfigValueType;
  isEnabled: boolean;
  description?: string;
}

// ==========================================
// 7. VERSIONED WORKFLOW STATE TRANSITIONS
// ==========================================
export enum WorkflowEntityType {
  ENCOUNTER = 'ENCOUNTER',
  CLINICAL_NOTE = 'CLINICAL_NOTE',
  CPOE_ORDER = 'CPOE_ORDER',
  SHA_CLAIM = 'SHA_CLAIM',
  INVOICE = 'INVOICE',
  INVENTORY_TRANSFER = 'INVENTORY_TRANSFER',
  MEDICATION_DISPENSE = 'MEDICATION_DISPENSE',
}

export enum WorkflowTrigger {
  CREATE = 'CREATE',
  SUBMIT = 'SUBMIT',
  VALIDATE = 'VALIDATE',
  AUTHORIZE = 'AUTHORIZE',
  DISPENSE = 'DISPENSE',
  PAY = 'PAY',
  CANCEL = 'CANCEL',
  REVISE = 'REVISE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  VOID = 'VOID',
}

export interface WorkflowStateTransitionEntity extends TenantScopedEntity {
  entityType: WorkflowEntityType;
  entityId: string;
  fromState: string;
  toState: string;
  version: number;
  trigger: WorkflowTrigger;
  actorUserId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * State Transition Rules per Workflow Entity
 */
export const ALLOWED_STATE_TRANSITIONS: Record<WorkflowEntityType, Record<string, string[]>> = {
  [WorkflowEntityType.ENCOUNTER]: {
    PLANNED: ['ARRIVED', 'CANCELLED'],
    ARRIVED: ['TRIAGED', 'IN_PROGRESS', 'CANCELLED'],
    TRIAGED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: ['REOPENED'],
    REOPENED: ['IN_PROGRESS', 'COMPLETED'],
    CANCELLED: [],
  },
  [WorkflowEntityType.CLINICAL_NOTE]: {
    DRAFT: ['FINALIZED', 'CANCELLED'],
    FINALIZED: ['AMENDED'], // Notes are immutable once signed; modifications require addendum
    AMENDED: ['AMENDED'],
    CANCELLED: [],
  },
  [WorkflowEntityType.CPOE_ORDER]: {
    ORDERED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['FULFILLED', 'DISPENSED', 'CANCELLED'],
    FULFILLED: [],
    DISPENSED: [],
    CANCELLED: [],
  },
  [WorkflowEntityType.SHA_CLAIM]: {
    DRAFT: ['VALIDATED', 'CANCELLED'],
    VALIDATED: ['QUEUED', 'DRAFT'],
    QUEUED: ['SUBMITTED', 'VALIDATED'],
    SUBMITTED: ['ACKNOWLEDGED', 'REJECTED'],
    ACKNOWLEDGED: ['APPROVED', 'REJECTED'],
    APPROVED: ['PAID'],
    REJECTED: ['APPEALED', 'DRAFT'],
    APPEALED: ['ACKNOWLEDGED', 'REJECTED'],
    PAID: [],
    CANCELLED: [],
  },
  [WorkflowEntityType.INVOICE]: {
    DRAFT: ['ISSUED', 'VOIDED'],
    ISSUED: ['PARTIALLY_PAID', 'PAID', 'VOIDED'],
    PARTIALLY_PAID: ['PAID', 'WRITTEN_OFF'],
    PAID: [],
    VOIDED: [],
    WRITTEN_OFF: [],
  },
  [WorkflowEntityType.INVENTORY_TRANSFER]: {
    REQUESTED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['RECEIVED', 'REJECTED'],
    RECEIVED: ['VERIFIED', 'REJECTED'],
    VERIFIED: [],
    REJECTED: [],
    CANCELLED: [],
  },
  [WorkflowEntityType.MEDICATION_DISPENSE]: {
    PREPARATION: ['IN_PROGRESS', 'COMPLETED', 'DECLINED', 'STOPPED'],
    IN_PROGRESS: ['COMPLETED', 'DECLINED', 'STOPPED'],
    COMPLETED: ['ENTERED_IN_ERROR'],
    DECLINED: [],
    STOPPED: [],
    ENTERED_IN_ERROR: [],
  },
};

export class WorkflowStateMachine {
  /**
   * Validates whether a state transition is legal according to clinical/financial workflow rules.
   */
  static isValidTransition(
    entityType: WorkflowEntityType,
    fromState: string,
    toState: string,
  ): boolean {
    const rules = ALLOWED_STATE_TRANSITIONS[entityType];
    if (!rules) return false;
    const allowedTargets = rules[fromState];
    if (!allowedTargets) return false;
    return allowedTargets.includes(toState);
  }

  /**
   * Asserts valid transition, throwing InvalidStateTransitionError if illegal.
   */
  static assertValidTransition(
    entityType: WorkflowEntityType,
    fromState: string,
    toState: string,
  ): void {
    if (!this.isValidTransition(entityType, fromState, toState)) {
      throw new InvalidStateTransitionError(
        `Illegal workflow state transition for ${entityType} from "${fromState}" to "${toState}".`,
      );
    }
  }
}

// ==========================================
// 8. PAGINATION, FILTERING & SORTING
// ==========================================
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  total: number,
  page: number = 1,
  limit: number = 20,
): PaginationMeta {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const totalPages = Math.ceil(total / safeLimit) || 1;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

// ==========================================
// 9. UNIFIED API RESPONSE ENVELOPES
// ==========================================
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
    timestamp: string;
    path?: string;
  };
}

export function createSuccessResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  details?: unknown,
  path?: string,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      statusCode,
      details,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

// ==========================================
// 10. PHARMACY, MEDICATION DISPENSING & INVENTORY MANAGEMENT
// ==========================================

export enum PharmacyProductCategory {
  ORAL_SOLID = 'ORAL_SOLID',
  ORAL_LIQUID = 'ORAL_LIQUID',
  INJECTABLE = 'INJECTABLE',
  TOPICAL = 'TOPICAL',
  INHALATION = 'INHALATION',
  OPHTHALMIC = 'OPHTHALMIC',
  MEDICAL_DEVICE = 'MEDICAL_DEVICE',
  CONSUMABLE = 'CONSUMABLE',
}

export enum DrugSchedule {
  PART_1_POISON = 'PART_1_POISON', // Prescription Only Medicine (POM) - Cap 244
  PART_2_POISON = 'PART_2_POISON', // Pharmacy Only (P) - Cap 244
  OVER_THE_COUNTER = 'OVER_THE_COUNTER', // General Sales List (GSL)
  CONTROLLED_NARCOTIC = 'CONTROLLED_NARCOTIC', // Controlled Substance / Dangerous Drug
}

export enum StorageCondition {
  ROOM_TEMPERATURE = 'ROOM_TEMPERATURE', // 15°C - 25°C
  REFRIGERATED = 'REFRIGERATED', // 2°C - 8°C Cold Chain
  FROZEN = 'FROZEN', // -20°C
  COOL_DRY = 'COOL_DRY', // Store below 15°C
  PROTECT_FROM_LIGHT = 'PROTECT_FROM_LIGHT',
}

export enum DispensingUnit {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  VIAL = 'VIAL',
  AMPOULE = 'AMPOULE',
  BOTTLE = 'BOTTLE',
  SACHET = 'SACHET',
  TUBE = 'TUBE',
  PIECE = 'PIECE',
  DOSE = 'DOSE',
  ML = 'ML',
}

export enum PackagingUnit {
  BOX = 'BOX',
  BLISTER_PACK = 'BLISTER_PACK',
  STRIP = 'STRIP',
  TIN = 'TIN',
  CARTON = 'CARTON',
  PACK = 'PACK',
}

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  QUARANTINED = 'QUARANTINED',
  EXPIRED = 'EXPIRED',
  DEPLETED = 'DEPLETED',
}

export enum StockMovementType {
  RECEIPT = 'RECEIPT',
  DISPENSATION = 'DISPENSATION',
  PARTIAL_DISPENSATION = 'PARTIAL_DISPENSATION',
  RETURN_TO_STOCK = 'RETURN_TO_STOCK',
  SUPPLIER_RETURN = 'SUPPLIER_RETURN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  ADJUSTMENT_DAMAGE = 'ADJUSTMENT_DAMAGE',
  ADJUSTMENT_EXPIRY = 'ADJUSTMENT_EXPIRY',
  ADJUSTMENT_RECONCILIATION = 'ADJUSTMENT_RECONCILIATION',
}

export enum StockMovementReferenceType {
  DISPENSE = 'DISPENSE',
  RETURN = 'RETURN',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  TRANSFER = 'TRANSFER',
  RECONCILIATION = 'RECONCILIATION',
  CORRECTION = 'CORRECTION',
}

export enum MedicationDispenseStatus {
  PREPARATION = 'PREPARATION',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ENTERED_IN_ERROR = 'ENTERED_IN_ERROR',
  STOPPED = 'STOPPED',
  DECLINED = 'DECLINED',
}

export enum DispenseType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  BALANCE_COMPLETION = 'BALANCE_COMPLETION',
}

export enum MedicationAdministrationStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NOT_DONE = 'NOT_DONE',
  ENTERED_IN_ERROR = 'ENTERED_IN_ERROR',
  ON_HOLD = 'ON_HOLD',
}

export enum ExpiryAlertLevel {
  GOOD = 'GOOD',
  EXPIRING_WARNING = 'EXPIRING_WARNING', // Expiring within 90 days
  EXPIRING_CRITICAL = 'EXPIRING_CRITICAL', // Expiring within 30 days
  EXPIRED = 'EXPIRED',
}

export interface PharmacyProductEntity extends BaseEntity {
  tenantId?: string;
  itemCode: string;
  genericName: string;
  brandName?: string;
  atcCode?: string;
  kemlCategory?: string;
  drugSchedule: DrugSchedule;
  category: PharmacyProductCategory;
  form: string;
  strength: string;
  strengthUnit: string;
  dispensingUnit: DispensingUnit;
  packagingUnit: PackagingUnit;
  packagingSize: number;
  storageCondition: StorageCondition;
  unitPrice: number;
  reorderLevel: number;
  maxStockLevel?: number;
  prescriptionRequired: boolean;
  controlledSubstance: boolean;
  isActive: boolean;
}

export interface PharmacySupplierEntity extends TenantScopedEntity {
  supplierCode: string;
  name: string;
  ppbLicenseNumber?: string;
  kraPin?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  physicalAddress?: string;
  leadTimeDays: number;
  isActive: boolean;
}

export interface PharmacyBatchEntity extends TenantScopedEntity {
  facilityId: string;
  productId: string;
  batchNumber: string;
  manufacturer?: string;
  manufacturedDate?: Date;
  expiryDate: Date;
  quantityReceived: number;
  quantityOnHand: number;
  quantityReserved: number;
  unitCost: number;
  sellingPrice: number;
  status: BatchStatus;
  storageBin?: string;
}

export interface PharmacyStockMovementEntity extends TenantScopedEntity {
  facilityId: string;
  productId: string;
  batchId?: string;
  movementType: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  referenceType?: StockMovementReferenceType;
  referenceId?: string;
  supplierId?: string;
  destinationFacilityId?: string;
  reason?: string;
  notes?: string;
  performedById: string;
  movementDate: Date;
}

export interface MedicationDispenseEntity extends TenantScopedEntity {
  facilityId: string;
  orderId: string;
  medicationRequestId: string;
  patientId: string;
  encounterId: string;
  dispenseNumber: string;
  status: MedicationDispenseStatus;
  dispenseType: DispenseType;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  daysSupply?: number;
  dosageInstructions?: string;
  dispenserId: string;
  dispensedAt: Date;
  authorizedById?: string;
  substitutionReason?: string;
  patientCounselingNotes?: string;
  notes?: string;
}

export interface MedicationDispenseItemEntity extends TenantScopedEntity {
  dispenseId: string;
  batchId: string;
  productId: string;
  quantityDispensed: number;
  unitPrice: number;
  totalPrice: number;
}

export interface MedicationAdministrationEntity extends TenantScopedEntity {
  facilityId: string;
  dispenseId?: string;
  medicationRequestId: string;
  encounterId: string;
  patientId: string;
  administratorId: string;
  administeredAt: Date;
  status: MedicationAdministrationStatus;
  doseQuantity: number;
  doseUnit: string;
  route: string;
  site?: string;
  reasonNotAdministered?: string;
  notes?: string;
}

export interface BatchAllocationItem {
  batchId: string;
  batchNumber: string;
  expiryDate: Date;
  unitCost: number;
  sellingPrice: number;
  availableOnHand: number;
  allocatedQuantity: number;
}

export interface BatchAllocationPlan {
  productId: string;
  requestedQuantity: number;
  allocatedTotal: number;
  shortfall: number;
  isFullyAllocated: boolean;
  allocations: BatchAllocationItem[];
}

export interface InventoryValuationItem {
  productId: string;
  itemCode: string;
  genericName: string;
  category: PharmacyProductCategory;
  totalQuantityOnHand: number;
  totalQuantityReserved: number;
  totalValuationCost: number;
  totalValuationRetail: number;
  activeBatchCount: number;
}

/**
 * FEFO (First-Expiry, First-Out) Batch Allocation Algorithm
 * Allocates inventory starting strictly with the earliest expiring ACTIVE, non-expired batch.
 */
export function allocateBatchesFEFO(
  batches: Array<{
    id: string;
    batchNumber: string;
    expiryDate: Date | string;
    quantityOnHand: number;
    quantityReserved?: number;
    unitCost?: number;
    sellingPrice?: number;
    status: BatchStatus | string;
  }>,
  requestedQuantity: number,
  referenceDate: Date = new Date(),
): BatchAllocationPlan {
  if (requestedQuantity <= 0) {
    return {
      productId: '',
      requestedQuantity,
      allocatedTotal: 0,
      shortfall: 0,
      isFullyAllocated: true,
      allocations: [],
    };
  }

  const refTime = referenceDate.getTime();

  // Filter to active, non-expired batches with positive available stock
  const availableBatches = batches
    .filter((b) => {
      const exp = new Date(b.expiryDate).getTime();
      const reserved = b.quantityReserved ?? 0;
      const available = b.quantityOnHand - reserved;
      return (
        b.status === BatchStatus.ACTIVE &&
        exp > refTime &&
        available > 0
      );
    })
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const allocations: BatchAllocationItem[] = [];
  let needed = requestedQuantity;

  for (const batch of availableBatches) {
    if (needed <= 0) break;
    const reserved = batch.quantityReserved ?? 0;
    const available = batch.quantityOnHand - reserved;
    const allocateQty = Math.min(needed, available);

    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: new Date(batch.expiryDate),
      unitCost: Number(batch.unitCost ?? 0),
      sellingPrice: Number(batch.sellingPrice ?? 0),
      availableOnHand: available,
      allocatedQuantity: allocateQty,
    });

    needed -= allocateQty;
  }

  const allocatedTotal = requestedQuantity - needed;

  return {
    productId: '',
    requestedQuantity,
    allocatedTotal,
    shortfall: needed,
    isFullyAllocated: needed === 0,
    allocations,
  };
}

/**
 * Calculates the expiry risk alert level for a batch.
 */
export function calculateExpiryRisk(
  expiryDate: Date | string,
  referenceDate: Date = new Date(),
  warningDays: number = 90,
  criticalDays: number = 30,
): ExpiryAlertLevel {
  const exp = new Date(expiryDate).getTime();
  const ref = referenceDate.getTime();
  const diffDays = Math.ceil((exp - ref) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return ExpiryAlertLevel.EXPIRED;
  }
  if (diffDays <= criticalDays) {
    return ExpiryAlertLevel.EXPIRING_CRITICAL;
  }
  if (diffDays <= warningDays) {
    return ExpiryAlertLevel.EXPIRING_WARNING;
  }
  return ExpiryAlertLevel.GOOD;
}

// ==========================================
// 8. PATIENT BILLING & PAYMENTS DOMAIN
// ==========================================

export enum BillingCategory {
  CONSULTATION = 'CONSULTATION',
  LABORATORY = 'LABORATORY',
  PHARMACY = 'PHARMACY',
  PROCEDURE = 'PROCEDURE',
  RADIOLOGY = 'RADIOLOGY',
  ACCOMMODATION = 'ACCOMMODATION',
  NURSING = 'NURSING',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  OTHER = 'OTHER',
  MISC = 'MISC',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceType {
  ORIGINAL = 'ORIGINAL',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
}

export enum PayerType {
  OUT_OF_POCKET = 'OUT_OF_POCKET',
  SHA_REIMBURSEMENT = 'SHA_REIMBURSEMENT',
  SPLIT_COPAY = 'SPLIT_COPAY',
  PRIVATE_INSURANCE = 'PRIVATE_INSURANCE',
}

export enum PaymentMethod {
  CASH = 'CASH',
  MPESA = 'MPESA',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DEBIT_CARD = 'DEBIT_CARD',
  CREDIT_CARD = 'CREDIT_CARD',
  CHEQUE = 'CHEQUE',
  INSURANCE_COPAY = 'INSURANCE_COPAY',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum AdjustmentType {
  DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE',
  DISCOUNT_FIXED = 'DISCOUNT_FIXED',
  CLINICAL_WAIVER = 'CLINICAL_WAIVER',
  CORRECTION = 'CORRECTION',
  WRITE_OFF = 'WRITE_OFF',
}

export enum AdjustmentStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReversalType {
  FULL_REVERSAL = 'FULL_REVERSAL',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
  CHARGEBACK = 'CHARGEBACK',
  ACCIDENTAL_ENTRY = 'ACCIDENTAL_ENTRY',
}

export enum ReversalStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReconciliationStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  RECONCILED = 'RECONCILED',
  DISCREPANCY_FLAGGED = 'DISCREPANCY_FLAGGED',
}

export enum EtimsStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  BUFFERED = 'BUFFERED',
  FAILED = 'FAILED',
  EXEMPT = 'EXEMPT',
}

export enum TaxCode {
  A = 'A', // Standard 16% VAT
  B = 'B', // Zero-rated 0%
  E = 'E', // VAT Exempt 0% (Medical services & human medicines under Kenya VAT Act First Schedule)
}

export interface BillingServiceEntity extends TenantScopedEntity {
  facilityId?: string;
  serviceCode: string;
  serviceName: string;
  category: BillingCategory;
  department: string;
  basePrice: number;
  taxRate: number;
  taxCode: TaxCode;
  clinicalCode?: string;
  clinicalCodingSystem?: string;
  shaCovered: boolean;
  shaStandardTariff: number;
  preauthorizationRequired: boolean;
  isActive: boolean;
}

export interface InvoiceEntity extends TenantScopedEntity {
  facilityId: string;
  patientId: string;
  encounterId?: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  payerType: PayerType;
  shaFundType?: string;
  shaClaimReference?: string;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  shaPortionAmount: number;
  patientPortionAmount: number;
  paidAmount: number;
  balanceDue: number;
  isSimulated: boolean;
  etimsStatus: EtimsStatus;
  etimsControlCode?: string;
  etimsQrCode?: string;
  etimsSignedAt?: Date;
  finalizedAt?: Date;
  finalizedById?: string;
  cancelledAt?: Date;
  cancelledById?: string;
  cancellationReason?: string;
  creditNoteInvoiceId?: string;
  notes?: string;
}

export interface InvoiceLineItemEntity extends TenantScopedEntity {
  invoiceId: string;
  billingServiceId?: string;
  sourceType: string;
  sourceReferenceId?: string;
  itemCode: string;
  itemDescription: string;
  category: BillingCategory;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  taxRate: number;
  taxCode: TaxCode;
  taxAmount: number;
  netAmount: number;
  shaCoverageAmount: number;
  patientPayableAmount: number;
  notes?: string;
}

export interface InvoiceTotalsCalculation {
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  shaPortionAmount: number;
  patientPortionAmount: number;
  balanceDue: number;
}

/**
 * Standard rounding to 2 decimal places for financial integrity.
 * Prevents floating point errors in totals and VAT calculations.
 */
export function roundCurrency(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates totals and tax for an invoice line item.
 */
export function calculateLineItemTotals(item: {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
  taxCode?: TaxCode | string;
  shaCoverageAmount?: number;
}): {
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  shaCoverageAmount: number;
  patientPayableAmount: number;
} {
  const qty = Number(item.quantity) || 1;
  const unitPrice = roundCurrency(Number(item.unitPrice) || 0);
  const gross = roundCurrency(qty * unitPrice);
  const discount = roundCurrency(Math.min(gross, Number(item.discountAmount) || 0));
  const amountAfterDiscount = roundCurrency(gross - discount);

  // Determine tax: VAT Act Exempt (Code 'E') or Zero (Code 'B') has 0% tax. Standard (Code 'A') has 16%
  let taxRate = 0;
  if (item.taxCode === TaxCode.A || item.taxCode === 'A') {
    const rawRate = item.taxRate !== undefined ? Number(item.taxRate) : 0.16;
    taxRate = rawRate > 1 ? rawRate / 100 : rawRate;
  }
  const taxAmount = roundCurrency(amountAfterDiscount * taxRate);
  const netAmount = roundCurrency(amountAfterDiscount + taxAmount);

  const shaCoverage = roundCurrency(Math.min(netAmount, Number(item.shaCoverageAmount) || 0));
  const patientPayable = roundCurrency(netAmount - shaCoverage);

  return {
    grossAmount: gross,
    discountAmount: discount,
    taxAmount,
    netAmount,
    shaCoverageAmount: shaCoverage,
    patientPayableAmount: patientPayable,
  };
}

/**
 * Computes aggregate totals across all invoice line items.
 */
export function calculateInvoiceTotals(
  items: Array<{
    grossAmount: number;
    discountAmount: number;
    taxAmount: number;
    netAmount: number;
    shaCoverageAmount: number;
    patientPayableAmount: number;
  }>,
  alreadyPaidAmount: number = 0,
): InvoiceTotalsCalculation {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let totalGross = 0;
  let shaTotal = 0;
  let patientTotal = 0;

  for (const it of items) {
    subtotal += it.grossAmount;
    discountTotal += it.discountAmount;
    taxTotal += it.taxAmount;
    totalGross += it.netAmount;
    shaTotal += it.shaCoverageAmount;
    patientTotal += it.patientPayableAmount;
  }

  const subtotalAmount = roundCurrency(subtotal);
  const discountAmount = roundCurrency(discountTotal);
  const taxAmount = roundCurrency(taxTotal);
  const totalAmount = roundCurrency(totalGross);
  const shaPortionAmount = roundCurrency(shaTotal);
  const patientPortionAmount = roundCurrency(patientTotal);
  const paid = roundCurrency(alreadyPaidAmount);
  const balanceDue = roundCurrency(Math.max(0, patientPortionAmount - paid));

  return {
    subtotalAmount,
    discountAmount,
    taxAmount,
    totalAmount,
    shaPortionAmount,
    patientPortionAmount,
    balanceDue,
  };
}

/**
 * Segregation of duties threshold check for discounts/adjustments:
 * Small discounts (e.g. <= 1,000 KES or <= 10%) can be auto-approved or requested by cashier.
 * Above threshold requires FACILITY_ADMIN or SUPER_ADMIN authorization.
 */
export function checkDiscountRequiresApproval(
  requestedDiscountKES: number,
  invoiceTotalKES: number,
  maxCashierDiscountKES: number = 1000,
  maxCashierDiscountPercent: number = 10,
): { requiresApproval: boolean; reason?: string } {
  const discount = roundCurrency(requestedDiscountKES);
  const total = roundCurrency(invoiceTotalKES);

  if (discount <= 0) {
    return { requiresApproval: false };
  }

  const discountPercent = total > 0 ? (discount / total) * 100 : 100;

  if (discount > maxCashierDiscountKES) {
    return {
      requiresApproval: true,
      reason: `Discount of KES ${discount.toLocaleString()} exceeds cashier limit of KES ${maxCashierDiscountKES.toLocaleString()}`,
    };
  }

  if (discountPercent > maxCashierDiscountPercent) {
    return {
      requiresApproval: true,
      reason: `Discount of ${discountPercent.toFixed(1)}% exceeds cashier limit of ${maxCashierDiscountPercent}%`,
    };
  }

  return { requiresApproval: false };
}

/**
 * Formats a currency amount into standard Kenyan Shillings string (KES X,XXX.XX)
 */
export function formatCurrencyKES(amount: number): string {
  const rounded = roundCurrency(amount);
  return `KES ${rounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export * from './crypto.js';
export * from './claims.js';

// ==========================================
// 11. INPATIENT ADMISSION, DISCHARGE & TRANSFER (ADT) & WARD/BED MANAGEMENT
// ==========================================

export enum InpatientAdmissionStatus {
  ADMITTED = 'ADMITTED',
  TRANSFERRED = 'TRANSFERRED',
  DISCHARGED = 'DISCHARGED',
  CANCELLED = 'CANCELLED',
}

export enum InpatientAdmissionType {
  EMERGENCY = 'EMERGENCY',
  ELECTIVE = 'ELECTIVE',
  NEWBORN = 'NEWBORN',
  TRANSFER_IN = 'TRANSFER_IN',
}

export enum InpatientDischargeDisposition {
  HOME_IMPROVED = 'HOME_IMPROVED',
  TRANSFERRED_OUT = 'TRANSFERRED_OUT',
  AGAINST_MEDICAL_ADVICE = 'AGAINST_MEDICAL_ADVICE',
  DECEASED = 'DECEASED',
  REFERRED = 'REFERRED',
}

export enum BedStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
}

export enum BedType {
  STANDARD = 'STANDARD',
  ICU = 'ICU',
  HDU = 'HDU',
  COT = 'COT',
  DELIVERY_BED = 'DELIVERY_BED',
  ISOLATION = 'ISOLATION',
}

export enum WardSpecialty {
  INTERNAL_MEDICINE = 'INTERNAL_MEDICINE',
  SURGICAL = 'SURGICAL',
  PEDIATRICS = 'PEDIATRICS',
  MATERNITY = 'MATERNITY',
  ICU = 'ICU',
  HDU = 'HDU',
  ISOLATION = 'ISOLATION',
  GENERAL = 'GENERAL',
}

export enum WardGenderRestriction {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NONE = 'NONE',
}

// ==========================================
// 12. OPERATING THEATRE & PROCEDURE SCHEDULING
// ==========================================

export enum TheatreType {
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  MATERNITY = 'MATERNITY',
  ENDOSCOPY = 'ENDOSCOPY',
}

export enum TheatreBookingStatus {
  SCHEDULED = 'SCHEDULED',
  PREOP = 'PREOP',
  IN_PROCEDURE = 'IN_PROCEDURE',
  POSTOP = 'POSTOP',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TheatreUrgency {
  ELECTIVE = 'ELECTIVE',
  URGENT = 'URGENT',
  EMERGENCY = 'EMERGENCY',
}

// ==========================================
// 13. MATERNITY & NEWBORN DOMAIN
// ==========================================

export enum DeliveryMode {
  SPONTANEOUS_VAGINAL = 'SPONTANEOUS_VAGINAL',
  ASSISTED_VAGINAL = 'ASSISTED_VAGINAL',
  CESAREAN_ELECTIVE = 'CESAREAN_ELECTIVE',
  CESAREAN_EMERGENCY = 'CESAREAN_EMERGENCY',
}

export enum DeliveryOutcome {
  LIVE_BIRTH = 'LIVE_BIRTH',
  STILLBIRTH_FRESH = 'STILLBIRTH_FRESH',
  STILLBIRTH_MACERATED = 'STILLBIRTH_MACERATED',
}

export enum PerinealTear {
  NONE = 'NONE',
  FIRST_DEGREE = 'FIRST_DEGREE',
  SECOND_DEGREE = 'SECOND_DEGREE',
  THIRD_DEGREE = 'THIRD_DEGREE',
  FOURTH_DEGREE = 'FOURTH_DEGREE',
}

export enum NewbornStatus {
  ACTIVE = 'ACTIVE',
  DISCHARGED = 'DISCHARGED',
  DECEASED = 'DECEASED',
  TRANSFERRED_NBU = 'TRANSFERRED_NBU',
}

// ==========================================
// 14. RADIOLOGY & AUTHORIZED IMAGING
// ==========================================

export enum RadiologyModality {
  XRAY = 'XRAY',
  ULTRASOUND = 'ULTRASOUND',
  CT_SCAN = 'CT_SCAN',
  MRI = 'MRI',
  MAMMOGRAPHY = 'MAMMOGRAPHY',
  FLUOROSCOPY = 'FLUOROSCOPY',
}

export enum RadiologyOrderStatus {
  REQUESTED = 'REQUESTED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RadiologyReportStatus {
  DRAFT = 'DRAFT',
  PRELIMINARY = 'PRELIMINARY',
  FINAL = 'FINAL',
  AMENDED = 'AMENDED',
}

export enum RadiologyUrgency {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  STAT = 'STAT',
}

// ==========================================
// 15. REFERRALS & COUNTER-REFERRALS
// ==========================================

export enum ReferralDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

export enum ReferralPriority {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  EMERGENCY = 'EMERGENCY',
}

export enum ReferralStatus {
  DRAFT = 'DRAFT',
  DISPATCHED = 'DISPATCHED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TransportType {
  AMBULANCE = 'AMBULANCE',
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

// ==========================================
// 16. APPOINTMENTS & SCHEDULING
// ==========================================

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_CONSULTATION = 'IN_CONSULTATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentServiceType {
  GENERAL_CONSULTATION = 'GENERAL_CONSULTATION',
  SPECIALIST_CLINIC = 'SPECIALIST_CLINIC',
  DENTAL = 'DENTAL',
  ANTENATAL = 'ANTENATAL',
  DIABETES_CLINIC = 'DIABETES_CLINIC',
  POSTNATAL = 'POSTNATAL',
  PHYSIOTHERAPY = 'PHYSIOTHERAPY',
  TELEMEDICINE = 'TELEMEDICINE',
}

// ==========================================
// 17. MEDICAL SUPPLIES & PROCUREMENT
// ==========================================

export enum ProcurementOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum ProcurementItemType {
  MEDICATION = 'MEDICATION',
  LAB_CONSUMABLE = 'LAB_CONSUMABLE',
  SURGICAL_SUPPLY = 'SURGICAL_SUPPLY',
  GENERAL_MEDICAL_SUPPLY = 'GENERAL_MEDICAL_SUPPLY',
}

export enum GrnStatus {
  ACCEPTED = 'ACCEPTED',
  PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED',
  REJECTED = 'REJECTED',
}

// ==========================================
// 18. PRIVATE INSURANCE ADAPTERS
// ==========================================

export enum PrivateInsurancePayer {
  JUBILEE = 'JUBILEE',
  AAR = 'AAR',
  APA = 'APA',
  BRITAM = 'BRITAM',
  OLD_MUTUAL = 'OLD_MUTUAL',
  UAP_OLD_MUTUAL = 'UAP_OLD_MUTUAL',
  CIC = 'CIC',
  FIRST_ASSURANCE = 'FIRST_ASSURANCE',
}

export enum InsurancePolicyStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export enum InsuranceAuthStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// ==========================================
// 19. STAFF ROSTERS & DEPARTMENTAL ASSIGNMENTS
// ==========================================

export enum ShiftType {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
  ON_CALL = 'ON_CALL',
  OFF_DUTY = 'OFF_DUTY',
  LEAVE = 'LEAVE',
}

export enum RosterStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

// ==========================================
// 20. COMMERCIAL SAAS ADMINISTRATION
// ==========================================

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum SubscriptionTier {
  LEVEL_2_CLINIC = 'LEVEL_2_CLINIC',
  LEVEL_3_HEALTH_CENTRE = 'LEVEL_3_HEALTH_CENTRE',
  LEVEL_4_HOSPITAL = 'LEVEL_4_HOSPITAL',
  LEVEL_5_COUNTY_REFERRAL = 'LEVEL_5_COUNTY_REFERRAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export enum PlatformInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
}

export enum PlatformPaymentMethod {
  MPESA = 'MPESA',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
}

export enum PlatformPaymentStatus {
  INITIATED = 'INITIATED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum DunningStage {
  INITIAL_FAILURE = 'INITIAL_FAILURE',
  GRACE_DAY_3 = 'GRACE_DAY_3',
  WARNING_DAY_7 = 'WARNING_DAY_7',
  RESTRICTED_DAY_14 = 'RESTRICTED_DAY_14',
  SUSPENDED_DAY_30 = 'SUSPENDED_DAY_30',
}

export enum SupportCaseCategory {
  BILLING = 'BILLING',
  TECHNICAL = 'TECHNICAL',
  CLINICAL_WORKFLOW = 'CLINICAL_WORKFLOW',
  INTEGRATION_ISSUE = 'INTEGRATION_ISSUE',
  ACCOUNT_ACCESS = 'ACCOUNT_ACCESS',
}

export enum SupportCasePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SupportCaseStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  PENDING_CUSTOMER = 'PENDING_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum SupportAccessScope {
  READ_ONLY = 'READ_ONLY',
  CONFIGURATION_ONLY = 'CONFIGURATION_ONLY',
  FULL_TROUBLESHOOTING = 'FULL_TROUBLESHOOTING',
}

export enum OffboardingStatus {
  REQUESTED = 'REQUESTED',
  DATA_EXPORT_GENERATED = 'DATA_EXPORT_GENERATED',
  ARCHIVE_GRACE_PERIOD = 'ARCHIVE_GRACE_PERIOD',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum MeteredMetricType {
  ENCOUNTERS = 'ENCOUNTERS',
  ACTIVE_USERS = 'ACTIVE_USERS',
  STORAGE_MB = 'STORAGE_MB',
  DHA_TRANSACTIONS = 'DHA_TRANSACTIONS',
  API_CALLS = 'API_CALLS',
}

export interface PlanFeatureEntitlements {
  inpatient?: boolean;
  theatre?: boolean;
  maternity?: boolean;
  radiology?: boolean;
  procurement?: boolean;
  privateInsurance?: boolean;
  dhaShr?: boolean;
  kraEtims?: boolean;
  advancedRosters?: boolean;
  [key: string]: boolean | undefined;
}

export interface SubscriptionPlanModel {
  id: string;
  code: string;
  name: string;
  facilityLevel: string;
  billingCycle: BillingCycle;
  basePriceKES: number;
  currency: string;
  maxUsers: number;
  maxMonthlyEncounters: number;
  maxStorageGB: number;
  features: PlanFeatureEntitlements;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSubscriptionModel {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}




