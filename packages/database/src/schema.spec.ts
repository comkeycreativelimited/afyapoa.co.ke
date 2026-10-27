import { describe, it, expect } from 'vitest';
import {
  tenants,
  facilities,
  users,
  practitionerProfiles,
  userSessions,
  passwordResets,
  auditEvents,
  patientRecords,
  patients,
  patientIdentifiers,
  patientConsents,
  patientReconciliations,
  patientAccessLogs,
  integrationConfigs,
  externalReferences,
  jobExecutions,
  fileMetadata,
  appConfigurations,
  workflowStateTransitions,
  encounters,
  triageVitals,
  patientAllergies,
  clinicalNotes,
  clinicalNoteAmendments,
  terminologyCatalogues,
  terminologyConcepts,
  diagnoses,
  clinicalOrders,
  medicationRequests,
  serviceRequests,
} from './schema.js';

describe('Database Schema Definitions', () => {
  it('should define all 26 foundational and clinical multi-tenant tables', () => {
    expect(tenants).toBeDefined();
    expect(facilities).toBeDefined();
    expect(users).toBeDefined();
    expect(practitionerProfiles).toBeDefined();
    expect(userSessions).toBeDefined();
    expect(passwordResets).toBeDefined();
    expect(auditEvents).toBeDefined();
    expect(patientRecords).toBeDefined();
    expect(patients).toBeDefined();
    expect(patientIdentifiers).toBeDefined();
    expect(patientConsents).toBeDefined();
    expect(patientReconciliations).toBeDefined();
    expect(patientAccessLogs).toBeDefined();
    expect(integrationConfigs).toBeDefined();
    expect(externalReferences).toBeDefined();
    expect(jobExecutions).toBeDefined();
    expect(fileMetadata).toBeDefined();
    expect(appConfigurations).toBeDefined();
    expect(workflowStateTransitions).toBeDefined();
    expect(encounters).toBeDefined();
    expect(triageVitals).toBeDefined();
    expect(patientAllergies).toBeDefined();
    expect(clinicalNotes).toBeDefined();
    expect(clinicalNoteAmendments).toBeDefined();
    expect(terminologyCatalogues).toBeDefined();
    expect(terminologyConcepts).toBeDefined();
    expect(diagnoses).toBeDefined();
    expect(clinicalOrders).toBeDefined();
    expect(medicationRequests).toBeDefined();
    expect(serviceRequests).toBeDefined();
  });

  it('tenants table should have code and status', () => {
    expect(tenants.code).toBeDefined();
    expect(tenants.status).toBeDefined();
  });

  it('facilities table should have kmflCode and tenantId', () => {
    expect(facilities.kmflCode).toBeDefined();
    expect(facilities.tenantId).toBeDefined();
  });

  it('users table should have tenantId, role, isSuperAdmin, and mfaEnabled', () => {
    expect(users.tenantId).toBeDefined();
    expect(users.role).toBeDefined();
    expect(users.isSuperAdmin).toBeDefined();
    expect(users.mfaEnabled).toBeDefined();
  });

  it('patientIdentifiers should have tenantId, system, valueBlindIndex, and status', () => {
    expect(patientIdentifiers.tenantId).toBeDefined();
    expect(patientIdentifiers.system).toBeDefined();
    expect(patientIdentifiers.valueBlindIndex).toBeDefined();
    expect(patientIdentifiers.valueEncrypted).toBeDefined();
    expect(patientIdentifiers.status).toBeDefined();
  });

  it('integrationConfigs should have tenantId, systemType, and endpointUrl', () => {
    expect(integrationConfigs.tenantId).toBeDefined();
    expect(integrationConfigs.systemType).toBeDefined();
    expect(integrationConfigs.endpointUrl).toBeDefined();
    expect(integrationConfigs.isActive).toBeDefined();
  });

  it('externalReferences should have tenantId, internalEntityType, and externalSystem', () => {
    expect(externalReferences.tenantId).toBeDefined();
    expect(externalReferences.internalEntityType).toBeDefined();
    expect(externalReferences.externalSystem).toBeDefined();
    expect(externalReferences.externalId).toBeDefined();
  });

  it('jobExecutions should have tenantId, queueName, jobType, and status', () => {
    expect(jobExecutions.tenantId).toBeDefined();
    expect(jobExecutions.queueName).toBeDefined();
    expect(jobExecutions.jobType).toBeDefined();
    expect(jobExecutions.status).toBeDefined();
    expect(jobExecutions.correlationId).toBeDefined();
  });

  it('fileMetadata should have tenantId, storageKey, sha256Checksum, and entityType', () => {
    expect(fileMetadata.tenantId).toBeDefined();
    expect(fileMetadata.storageKey).toBeDefined();
    expect(fileMetadata.sha256Checksum).toBeDefined();
    expect(fileMetadata.entityType).toBeDefined();
  });

  it('workflowStateTransitions should have tenantId, entityType, fromState, toState, and version', () => {
    expect(workflowStateTransitions.tenantId).toBeDefined();
    expect(workflowStateTransitions.entityType).toBeDefined();
    expect(workflowStateTransitions.fromState).toBeDefined();
    expect(workflowStateTransitions.toState).toBeDefined();
    expect(workflowStateTransitions.version).toBeDefined();
  });

  it('patients should have tenantId, primaryFacilityId, mrn, firstName, lastName, dateOfBirth, gender, phoneBlindIndex, and identityStatus', () => {
    expect(patients.tenantId).toBeDefined();
    expect(patients.primaryFacilityId).toBeDefined();
    expect(patients.mrn).toBeDefined();
    expect(patients.firstName).toBeDefined();
    expect(patients.lastName).toBeDefined();
    expect(patients.dateOfBirth).toBeDefined();
    expect(patients.gender).toBeDefined();
    expect(patients.phoneBlindIndex).toBeDefined();
    expect(patients.identityStatus).toBeDefined();
    expect(patients.dhaCrid).toBeDefined();
  });

  it('patientConsents should have tenantId, patientId, consentType, status, and policyVersion', () => {
    expect(patientConsents.tenantId).toBeDefined();
    expect(patientConsents.patientId).toBeDefined();
    expect(patientConsents.consentType).toBeDefined();
    expect(patientConsents.status).toBeDefined();
    expect(patientConsents.policyVersion).toBeDefined();
  });

  it('patientReconciliations should have tenantId, sourcePatientId, targetPatientId, status, and confidenceScore', () => {
    expect(patientReconciliations.tenantId).toBeDefined();
    expect(patientReconciliations.sourcePatientId).toBeDefined();
    expect(patientReconciliations.targetPatientId).toBeDefined();
    expect(patientReconciliations.status).toBeDefined();
    expect(patientReconciliations.confidenceScore).toBeDefined();
  });

  it('patientAccessLogs should have tenantId, patientId, accessedById, purpose, and accessType', () => {
    expect(patientAccessLogs.tenantId).toBeDefined();
    expect(patientAccessLogs.patientId).toBeDefined();
    expect(patientAccessLogs.accessedById).toBeDefined();
    expect(patientAccessLogs.purpose).toBeDefined();
    expect(patientAccessLogs.accessType).toBeDefined();
  });

  it('encounters should have tenantId, facilityId, patientId, encounterNumber, status, and priority', () => {
    expect(encounters.tenantId).toBeDefined();
    expect(encounters.facilityId).toBeDefined();
    expect(encounters.patientId).toBeDefined();
    expect(encounters.encounterNumber).toBeDefined();
    expect(encounters.status).toBeDefined();
    expect(encounters.priority).toBeDefined();
  });

  it('triageVitals should have tenantId, encounterId, patientId, assessedById, and vitals fields', () => {
    expect(triageVitals.tenantId).toBeDefined();
    expect(triageVitals.encounterId).toBeDefined();
    expect(triageVitals.patientId).toBeDefined();
    expect(triageVitals.assessedById).toBeDefined();
    expect(triageVitals.systolicBp).toBeDefined();
    expect(triageVitals.diastolicBp).toBeDefined();
    expect(triageVitals.heartRate).toBeDefined();
    expect(triageVitals.temperature).toBeDefined();
    expect(triageVitals.bmi).toBeDefined();
  });

  it('patientAllergies should have tenantId, patientId, allergen, severity, and clinicalStatus', () => {
    expect(patientAllergies.tenantId).toBeDefined();
    expect(patientAllergies.patientId).toBeDefined();
    expect(patientAllergies.allergen).toBeDefined();
    expect(patientAllergies.severity).toBeDefined();
    expect(patientAllergies.clinicalStatus).toBeDefined();
  });

  it('clinicalNotes should have tenantId, encounterId, patientId, authorId, status, assessment, and plan', () => {
    expect(clinicalNotes.tenantId).toBeDefined();
    expect(clinicalNotes.encounterId).toBeDefined();
    expect(clinicalNotes.patientId).toBeDefined();
    expect(clinicalNotes.authorId).toBeDefined();
    expect(clinicalNotes.status).toBeDefined();
    expect(clinicalNotes.assessment).toBeDefined();
    expect(clinicalNotes.plan).toBeDefined();
  });

  it('clinicalNoteAmendments should have tenantId, noteId, amendedById, reason, and amendmentText', () => {
    expect(clinicalNoteAmendments.tenantId).toBeDefined();
    expect(clinicalNoteAmendments.noteId).toBeDefined();
    expect(clinicalNoteAmendments.amendedById).toBeDefined();
    expect(clinicalNoteAmendments.reason).toBeDefined();
    expect(clinicalNoteAmendments.amendmentText).toBeDefined();
  });

  it('terminologyCatalogues should have system, version, name, and authority', () => {
    expect(terminologyCatalogues.system).toBeDefined();
    expect(terminologyCatalogues.version).toBeDefined();
    expect(terminologyCatalogues.name).toBeDefined();
    expect(terminologyCatalogues.authority).toBeDefined();
  });

  it('terminologyConcepts should have catalogueId, code, display, and system', () => {
    expect(terminologyConcepts.catalogueId).toBeDefined();
    expect(terminologyConcepts.code).toBeDefined();
    expect(terminologyConcepts.display).toBeDefined();
    expect(terminologyConcepts.system).toBeDefined();
  });

  it('diagnoses should have tenantId, encounterId, patientId, recordedById, code, and codingSystem', () => {
    expect(diagnoses.tenantId).toBeDefined();
    expect(diagnoses.encounterId).toBeDefined();
    expect(diagnoses.patientId).toBeDefined();
    expect(diagnoses.recordedById).toBeDefined();
    expect(diagnoses.code).toBeDefined();
    expect(diagnoses.codingSystem).toBeDefined();
  });

  it('clinicalOrders should have tenantId, orderNumber, orderType, status, priority, and intent', () => {
    expect(clinicalOrders.tenantId).toBeDefined();
    expect(clinicalOrders.orderNumber).toBeDefined();
    expect(clinicalOrders.orderType).toBeDefined();
    expect(clinicalOrders.status).toBeDefined();
    expect(clinicalOrders.priority).toBeDefined();
    expect(clinicalOrders.intent).toBeDefined();
  });

  it('medicationRequests should have tenantId, orderId, medicationCode, dosage, route, and frequency', () => {
    expect(medicationRequests.tenantId).toBeDefined();
    expect(medicationRequests.orderId).toBeDefined();
    expect(medicationRequests.medicationCode).toBeDefined();
    expect(medicationRequests.dosage).toBeDefined();
    expect(medicationRequests.route).toBeDefined();
    expect(medicationRequests.frequency).toBeDefined();
  });

  it('serviceRequests should have tenantId, orderId, serviceCategory, serviceCode, and urgency', () => {
    expect(serviceRequests.tenantId).toBeDefined();
    expect(serviceRequests.orderId).toBeDefined();
    expect(serviceRequests.serviceCategory).toBeDefined();
    expect(serviceRequests.serviceCode).toBeDefined();
    expect(serviceRequests.urgency).toBeDefined();
  });
});

