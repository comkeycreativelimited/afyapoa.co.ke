import postgres from 'postgres';
import { config } from '@afyapoa/config';

async function runMigrations() {
  console.log('[MIGRATION] Connecting to PostgreSQL database as admin...');
  const sql = postgres(config.DATABASE_URL, { max: 1 });

  try {
    console.log('[MIGRATION] Applying core extensions and schema tables...');

    // Extensions
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;
    await sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`;

    // Create dedicated application role without SUPERUSER or BYPASSRLS
    console.log('[MIGRATION] Provisioning dedicated application role (afyapoa_app)...');
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'afyapoa_app') THEN
          CREATE ROLE afyapoa_app WITH LOGIN PASSWORD 'afyapoa_dev_password' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `;

    // 1. Tenants (Hospital Organizations)
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        tier VARCHAR(32) DEFAULT 'COMMERCIAL' NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 2. Facilities (Hospital Branches / KMFL Delivery Points)
    await sql`
      CREATE TABLE IF NOT EXISTS facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        kmfl_code VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        level VARCHAR(32) NOT NULL,
        county VARCHAR(100) NOT NULL,
        sub_county VARCHAR(100) NOT NULL,
        physical_address TEXT NOT NULL,
        contact_phone VARCHAR(32) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        sha_contract_code VARCHAR(64),
        dha_hie_endpoint VARCHAR(255),
        kra_pin VARCHAR(32),
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS facilities_tenant_idx ON facilities(tenant_id);`;

    // 3. Users
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        primary_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        mfa_secret VARCHAR(128),
        is_super_admin BOOLEAN DEFAULT FALSE NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT users_tenant_username_uniq UNIQUE (tenant_id, username),
        CONSTRAINT users_tenant_email_uniq UNIQUE (tenant_id, email)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS users_tenant_role_idx ON users(tenant_id, role);`;

    // 4. Practitioner Profiles
    await sql`
      CREATE TABLE IF NOT EXISTS practitioner_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        puid VARCHAR(64) NOT NULL UNIQUE,
        cadre VARCHAR(64) NOT NULL,
        regulatory_board VARCHAR(32) NOT NULL,
        license_number VARCHAR(64) NOT NULL,
        license_status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        license_expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS practitioners_tenant_idx ON practitioner_profiles(tenant_id);`;

    // 5. User Sessions
    await sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(255) NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(64),
        is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS user_sessions_tenant_user_idx ON user_sessions(tenant_id, user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);`;

    // 6. Password Resets
    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        is_used BOOLEAN DEFAULT FALSE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS password_resets_token_idx ON password_resets(token_hash);`;
    await sql`CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);`;

    // 7. Audit Events (WORM Append-only Log)
    await sql`
      CREATE TABLE IF NOT EXISTS audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID,
        action VARCHAR(64) NOT NULL,
        resource VARCHAR(64) NOT NULL,
        resource_id VARCHAR(128),
        client_ip VARCHAR(64),
        user_agent TEXT,
        details TEXT,
        previous_hash VARCHAR(64) NOT NULL,
        event_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx ON audit_events(tenant_id, created_at);`;
    await sql`CREATE INDEX IF NOT EXISTS audit_events_resource_idx ON audit_events(tenant_id, resource, resource_id);`;

    // 8. Patient Records (Sample tenant-owned records for multi-tenancy verification)
    await sql`
      CREATE TABLE IF NOT EXISTS patient_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        record_number VARCHAR(64) NOT NULL,
        patient_alias VARCHAR(100) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT patient_records_tenant_rec_uniq UNIQUE (tenant_id, record_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patient_records_tenant_facility_idx ON patient_records(tenant_id, facility_id);`;

    // 8.5. Patients (Master Patient Index & Demographics)
    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        primary_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
        mrn VARCHAR(64) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        last_name VARCHAR(100) NOT NULL,
        date_of_birth VARCHAR(32) NOT NULL,
        is_dob_estimated BOOLEAN DEFAULT FALSE NOT NULL,
        gender VARCHAR(32) NOT NULL,
        blood_group VARCHAR(16),
        phone_encrypted TEXT,
        phone_blind_index VARCHAR(64),
        phone_masked VARCHAR(32),
        email VARCHAR(255),
        physical_address TEXT,
        county VARCHAR(100),
        sub_county VARCHAR(100),
        ward VARCHAR(100),
        village VARCHAR(100),
        postal_code VARCHAR(32),
        nationality VARCHAR(64) DEFAULT 'KENYAN' NOT NULL,
        marital_status VARCHAR(32),
        emergency_contact TEXT,
        is_emergency_unknown BOOLEAN DEFAULT FALSE NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        identity_status VARCHAR(32) DEFAULT 'LOCAL_ONLY' NOT NULL,
        dha_crid VARCHAR(64),
        sha_number VARCHAR(64),
        upi VARCHAR(64),
        reconciled_into_patient_id UUID,
        reconciliation_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT patients_tenant_mrn_uniq UNIQUE (tenant_id, mrn)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patients_tenant_phone_bindex_idx ON patients(tenant_id, phone_blind_index);`;
    await sql`CREATE INDEX IF NOT EXISTS patients_tenant_status_idx ON patients(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS patients_tenant_identity_status_idx ON patients(tenant_id, identity_status);`;
    await sql`CREATE INDEX IF NOT EXISTS patients_tenant_crid_idx ON patients(tenant_id, dha_crid);`;
    await sql`CREATE INDEX IF NOT EXISTS patients_tenant_facility_idx ON patients(tenant_id, primary_facility_id);`;

    // 9. Patient Identifiers
    await sql`
      CREATE TABLE IF NOT EXISTS patient_identifiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        system VARCHAR(64) NOT NULL,
        value_encrypted TEXT NOT NULL,
        value_blind_index VARCHAR(64) NOT NULL,
        value_masked VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE NOT NULL,
        patient_alias VARCHAR(100) NOT NULL,
        issuing_authority VARCHAR(64),
        verification_status VARCHAR(32) DEFAULT 'UNVERIFIED' NOT NULL,
        verification_method VARCHAR(64),
        verified_at TIMESTAMPTZ,
        verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT patient_identifiers_tenant_bindex_uniq UNIQUE (tenant_id, system, value_blind_index)
      );
    `;
    await sql`ALTER TABLE patient_identifiers ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE patient_identifiers ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(64);`;
    await sql`ALTER TABLE patient_identifiers ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'UNVERIFIED' NOT NULL;`;
    await sql`ALTER TABLE patient_identifiers ADD COLUMN IF NOT EXISTS verification_method VARCHAR(64);`;
    await sql`ALTER TABLE patient_identifiers ADD COLUMN IF NOT EXISTS notes TEXT;`;
    await sql`CREATE INDEX IF NOT EXISTS patient_identifiers_tenant_status_idx ON patient_identifiers(tenant_id, system, status);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_identifiers_tenant_facility_idx ON patient_identifiers(tenant_id, facility_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_identifiers_tenant_patient_idx ON patient_identifiers(tenant_id, patient_id);`;

    // 9.1. Patient Consents
    await sql`
      CREATE TABLE IF NOT EXISTS patient_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        consent_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'GRANTED' NOT NULL,
        channel VARCHAR(32) DEFAULT 'WRITTEN_FORM' NOT NULL,
        policy_version VARCHAR(32) DEFAULT 'KE-DPA-2019-V1' NOT NULL,
        granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revocation_reason TEXT,
        captured_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        witness_name VARCHAR(255),
        otp_reference VARCHAR(64),
        metadata TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patient_consents_tenant_patient_idx ON patient_consents(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_consents_tenant_type_status_idx ON patient_consents(tenant_id, consent_type, status);`;

    // 9.2. Patient Reconciliations
    await sql`
      CREATE TABLE IF NOT EXISTS patient_reconciliations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        target_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL,
        confidence_score VARCHAR(16) NOT NULL,
        match_reasons TEXT NOT NULL,
        action_notes TEXT,
        reconciled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reconciled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patient_reconciliations_tenant_source_idx ON patient_reconciliations(tenant_id, source_patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_reconciliations_tenant_target_idx ON patient_reconciliations(tenant_id, target_patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_reconciliations_tenant_status_idx ON patient_reconciliations(tenant_id, status);`;

    // 9.3. Patient Access Logs
    await sql`
      CREATE TABLE IF NOT EXISTS patient_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        accessed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        purpose VARCHAR(64) NOT NULL,
        access_type VARCHAR(32) NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(512),
        details TEXT,
        accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patient_access_logs_tenant_patient_idx ON patient_access_logs(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_access_logs_tenant_accessed_by_idx ON patient_access_logs(tenant_id, accessed_by_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_access_logs_tenant_accessed_at_idx ON patient_access_logs(tenant_id, accessed_at);`;

    // 10. Integration Configurations
    await sql`
      CREATE TABLE IF NOT EXISTS integration_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
        system_type VARCHAR(64) NOT NULL,
        environment VARCHAR(32) DEFAULT 'MOCK' NOT NULL,
        endpoint_url TEXT NOT NULL,
        auth_type VARCHAR(32) DEFAULT 'OAUTH2' NOT NULL,
        credentials_encrypted TEXT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL,
        timeout_ms INTEGER DEFAULT 15000 NOT NULL,
        settings TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS integration_configs_tenant_sys_idx ON integration_configs(tenant_id, system_type);`;

    // 11. External References
    await sql`
      CREATE TABLE IF NOT EXISTS external_references (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        internal_entity_type VARCHAR(64) NOT NULL,
        internal_entity_id UUID NOT NULL,
        external_system VARCHAR(64) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
        sync_attempts INTEGER DEFAULT 0 NOT NULL,
        last_synced_at TIMESTAMPTZ,
        response_metadata TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT ext_refs_tenant_entity_sys_uniq UNIQUE (tenant_id, internal_entity_type, internal_entity_id, external_system)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS ext_refs_tenant_external_lookup_idx ON external_references(tenant_id, external_system, external_id);`;

    // 11B. Registry Sync Records
    await sql`
      CREATE TABLE IF NOT EXISTS registry_sync_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        registry_type VARCHAR(64) NOT NULL,
        record_key VARCHAR(255) NOT NULL,
        internal_entity_id UUID,
        external_id VARCHAR(255),
        sync_status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
        version VARCHAR(64) DEFAULT '1' NOT NULL,
        etag VARCHAR(128),
        freshness_ttl_seconds INTEGER DEFAULT 86400 NOT NULL,
        last_synced_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        source_provenance TEXT,
        cached_data_encrypted TEXT,
        last_error TEXT,
        is_offline_created BOOLEAN DEFAULT FALSE NOT NULL,
        retired_at TIMESTAMPTZ,
        retired_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT reg_sync_tenant_type_key_uniq UNIQUE (tenant_id, registry_type, record_key)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS reg_sync_tenant_status_idx ON registry_sync_records(tenant_id, sync_status);`;
    await sql`CREATE INDEX IF NOT EXISTS reg_sync_tenant_expires_idx ON registry_sync_records(tenant_id, expires_at);`;
    await sql`CREATE INDEX IF NOT EXISTS reg_sync_tenant_external_idx ON registry_sync_records(tenant_id, external_id);`;

    // 12. Job Executions
    await sql`
      CREATE TABLE IF NOT EXISTS job_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        queue_name VARCHAR(64) NOT NULL,
        job_type VARCHAR(64) NOT NULL,
        payload TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
        correlation_id VARCHAR(128) NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 3 NOT NULL,
        error_details TEXT,
        locked_at TIMESTAMPTZ,
        locked_by VARCHAR(128),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS job_executions_tenant_status_idx ON job_executions(tenant_id, queue_name, status);`;
    await sql`CREATE INDEX IF NOT EXISTS job_executions_tenant_corr_idx ON job_executions(tenant_id, correlation_id);`;

    // 13. File Metadata
    await sql`
      CREATE TABLE IF NOT EXISTS file_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        storage_driver VARCHAR(32) DEFAULT 'LOCAL' NOT NULL,
        storage_key TEXT NOT NULL,
        bucket_name VARCHAR(128) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256_checksum VARCHAR(64) NOT NULL,
        entity_type VARCHAR(64) NOT NULL,
        entity_id UUID NOT NULL,
        access_level VARCHAR(32) DEFAULT 'CONFIDENTIAL' NOT NULL,
        is_encrypted BOOLEAN DEFAULT FALSE NOT NULL,
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS file_metadata_tenant_entity_idx ON file_metadata(tenant_id, entity_type, entity_id);`;
    await sql`CREATE INDEX IF NOT EXISTS file_metadata_tenant_checksum_idx ON file_metadata(tenant_id, sha256_checksum);`;

    // 14. App Configurations
    await sql`
      CREATE TABLE IF NOT EXISTS app_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        config_key VARCHAR(128) NOT NULL,
        config_value TEXT NOT NULL,
        value_type VARCHAR(32) DEFAULT 'STRING' NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS app_configs_tenant_key_idx ON app_configurations(tenant_id, config_key);`;

    // 15. Workflow State Transitions
    await sql`
      CREATE TABLE IF NOT EXISTS workflow_state_transitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type VARCHAR(64) NOT NULL,
        entity_id UUID NOT NULL,
        from_state VARCHAR(64) NOT NULL,
        to_state VARCHAR(64) NOT NULL,
        version INTEGER NOT NULL,
        trigger VARCHAR(64) NOT NULL,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        metadata TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS workflow_trans_tenant_entity_ver_idx ON workflow_state_transitions(tenant_id, entity_type, entity_id, version);`;

    // 16. Encounters
    await sql`
      CREATE TABLE IF NOT EXISTS encounters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        practitioner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        encounter_number VARCHAR(64) NOT NULL,
        encounter_type VARCHAR(32) NOT NULL,
        service_department VARCHAR(64) DEFAULT 'OUTPATIENT' NOT NULL,
        status VARCHAR(32) DEFAULT 'ARRIVED' NOT NULL,
        priority VARCHAR(32) DEFAULT 'SEMI_URGENT' NOT NULL,
        reason_for_visit TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        ended_at TIMESTAMPTZ,
        reopened_at TIMESTAMPTZ,
        reopened_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reopening_reason TEXT,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT encounters_tenant_number_uniq UNIQUE (tenant_id, encounter_number)
      );
    `;
    await sql`ALTER TABLE encounters DROP CONSTRAINT IF EXISTS encounters_patient_id_fkey;`;
    await sql`ALTER TABLE encounters ADD CONSTRAINT encounters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;`;
    await sql`CREATE INDEX IF NOT EXISTS encounters_tenant_patient_idx ON encounters(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS encounters_tenant_status_idx ON encounters(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS encounters_tenant_dept_idx ON encounters(tenant_id, service_department, status);`;
    await sql`CREATE INDEX IF NOT EXISTS encounters_tenant_facility_idx ON encounters(tenant_id, facility_id);`;

    // 17. Triage Vitals
    await sql`
      CREATE TABLE IF NOT EXISTS triage_vitals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        assessed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        heart_rate INTEGER,
        respiratory_rate INTEGER,
        temperature NUMERIC(4, 1),
        oxygen_saturation INTEGER,
        weight_kg NUMERIC(5, 2),
        height_cm NUMERIC(5, 1),
        bmi NUMERIC(4, 1),
        blood_glucose NUMERIC(4, 1),
        avpu_level VARCHAR(32) DEFAULT 'ALERT',
        triage_priority VARCHAR(32) DEFAULT 'SEMI_URGENT' NOT NULL,
        triage_notes TEXT,
        assessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS triage_vitals_tenant_encounter_idx ON triage_vitals(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS triage_vitals_tenant_patient_idx ON triage_vitals(tenant_id, patient_id);`;

    // 18. Patient Allergies
    await sql`
      CREATE TABLE IF NOT EXISTS patient_allergies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        recorded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        allergen VARCHAR(255) NOT NULL,
        allergen_type VARCHAR(64) DEFAULT 'MEDICATION' NOT NULL,
        severity VARCHAR(32) DEFAULT 'MODERATE' NOT NULL,
        reaction VARCHAR(255),
        clinical_status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        verification_status VARCHAR(32) DEFAULT 'CONFIRMED' NOT NULL,
        onset_age_years INTEGER,
        notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS patient_allergies_tenant_patient_idx ON patient_allergies(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS patient_allergies_tenant_status_idx ON patient_allergies(tenant_id, clinical_status);`;

    // 19. Clinical Notes
    await sql`
      CREATE TABLE IF NOT EXISTS clinical_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        note_type VARCHAR(64) DEFAULT 'CONSULTATION_NOTE' NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        chief_complaint TEXT NOT NULL,
        history_of_present_illness TEXT,
        past_medical_history TEXT,
        review_of_systems TEXT,
        physical_examination TEXT,
        assessment TEXT NOT NULL,
        plan TEXT NOT NULL,
        entry_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        effective_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        finalized_at TIMESTAMPTZ,
        finalized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        digital_signature VARCHAR(255),
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS digital_signature VARCHAR(255);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_notes_tenant_encounter_idx ON clinical_notes(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_notes_tenant_patient_idx ON clinical_notes(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_notes_tenant_status_idx ON clinical_notes(tenant_id, status);`;

    // 20. Clinical Note Amendments
    await sql`
      CREATE TABLE IF NOT EXISTS clinical_note_amendments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        note_id UUID NOT NULL REFERENCES clinical_notes(id) ON DELETE CASCADE,
        amended_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        amendment_text TEXT NOT NULL,
        amended_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS clinical_note_amend_tenant_note_idx ON clinical_note_amendments(tenant_id, note_id);`;

    // 21. Terminology Catalogues (Global Reference)
    await sql`
      CREATE TABLE IF NOT EXISTS terminology_catalogues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        system VARCHAR(64) NOT NULL,
        version VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        authority VARCHAR(255) NOT NULL,
        release_date VARCHAR(32),
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        concept_count INTEGER DEFAULT 0 NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT terminology_catalogues_system_version_uniq UNIQUE (system, version)
      );
    `;

    // 22. Terminology Concepts (Global Reference)
    await sql`
      CREATE TABLE IF NOT EXISTS terminology_concepts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        catalogue_id UUID NOT NULL REFERENCES terminology_catalogues(id) ON DELETE CASCADE,
        code VARCHAR(64) NOT NULL,
        display TEXT NOT NULL,
        definition TEXT,
        system VARCHAR(64) NOT NULL,
        version VARCHAR(32) NOT NULL,
        effective_start_date VARCHAR(32),
        effective_end_date VARCHAR(32),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        synonyms JSONB,
        parent_code VARCHAR(64),
        category VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT terminology_concepts_system_code_uniq UNIQUE (system, code)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS terminology_concepts_catalogue_idx ON terminology_concepts(catalogue_id);`;
    await sql`CREATE INDEX IF NOT EXISTS terminology_concepts_code_idx ON terminology_concepts(code);`;
    await sql`CREATE INDEX IF NOT EXISTS terminology_concepts_category_idx ON terminology_concepts(category);`;

    // 23. Diagnoses
    await sql`
      CREATE TABLE IF NOT EXISTS diagnoses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        recorded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        code VARCHAR(64) NOT NULL,
        coding_system VARCHAR(64) DEFAULT 'ICD_11_MMS' NOT NULL,
        display TEXT NOT NULL,
        diagnosis_type VARCHAR(32) DEFAULT 'WORKING' NOT NULL,
        clinical_status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        verification_status VARCHAR(32) DEFAULT 'PROVISIONAL' NOT NULL,
        certainty VARCHAR(32) DEFAULT 'SUSPECTED',
        is_primary BOOLEAN DEFAULT FALSE NOT NULL,
        onset_date TIMESTAMPTZ,
        notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS diagnoses_tenant_encounter_idx ON diagnoses(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnoses_tenant_patient_idx ON diagnoses(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnoses_tenant_code_idx ON diagnoses(tenant_id, code);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnoses_tenant_status_idx ON diagnoses(tenant_id, clinical_status);`;

    // 24. Clinical Orders
    await sql`
      CREATE TABLE IF NOT EXISTS clinical_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        ordering_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        order_number VARCHAR(64) NOT NULL,
        order_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'SUBMITTED' NOT NULL,
        priority VARCHAR(32) DEFAULT 'ROUTINE' NOT NULL,
        intent VARCHAR(32) DEFAULT 'ORDER' NOT NULL,
        clinical_indication TEXT,
        notes TEXT,
        ordered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        authorized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        authorized_at TIMESTAMPTZ,
        cancelled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        cancelled_at TIMESTAMPTZ,
        cancellation_reason TEXT,
        amendment_reason TEXT,
        amended_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        amended_at TIMESTAMPTZ,
        superseded_order_id UUID,
        duplicate_hash VARCHAR(64),
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT clinical_orders_tenant_number_uniq UNIQUE (tenant_id, order_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_encounter_idx ON clinical_orders(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_patient_idx ON clinical_orders(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_practitioner_idx ON clinical_orders(tenant_id, ordering_practitioner_id);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_status_idx ON clinical_orders(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_type_idx ON clinical_orders(tenant_id, order_type);`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_orders_tenant_duplicate_hash_idx ON clinical_orders(tenant_id, duplicate_hash);`;

    // 25. Medication Requests
    await sql`
      CREATE TABLE IF NOT EXISTS medication_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        medication_code VARCHAR(64) NOT NULL,
        medication_name VARCHAR(255) NOT NULL,
        coding_system VARCHAR(64) DEFAULT 'KENYA_EML' NOT NULL,
        dosage VARCHAR(64) NOT NULL,
        dosage_unit VARCHAR(32) NOT NULL,
        route VARCHAR(32) DEFAULT 'ORAL' NOT NULL,
        frequency VARCHAR(32) DEFAULT 'TID' NOT NULL,
        duration_value INTEGER DEFAULT 5 NOT NULL,
        duration_unit VARCHAR(32) DEFAULT 'DAYS' NOT NULL,
        total_quantity INTEGER NOT NULL,
        quantity_unit VARCHAR(32) DEFAULT 'TABLETS' NOT NULL,
        instructions TEXT,
        refills_allowed INTEGER DEFAULT 0 NOT NULL,
        is_prn BOOLEAN DEFAULT FALSE NOT NULL,
        prn_reason VARCHAR(255),
        substitution_allowed BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS med_requests_tenant_order_idx ON medication_requests(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_requests_tenant_patient_idx ON medication_requests(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_requests_tenant_code_idx ON medication_requests(tenant_id, medication_code);`;

    // 26. Service Requests
    await sql`
      CREATE TABLE IF NOT EXISTS service_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        service_category VARCHAR(64) DEFAULT 'LABORATORY' NOT NULL,
        service_code VARCHAR(64) NOT NULL,
        service_name VARCHAR(255) NOT NULL,
        coding_system VARCHAR(64) DEFAULT 'LOINC' NOT NULL,
        specimen_type VARCHAR(64),
        body_site VARCHAR(255),
        clinical_notes TEXT,
        urgency VARCHAR(32) DEFAULT 'ROUTINE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS service_requests_tenant_order_idx ON service_requests(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS service_requests_tenant_patient_idx ON service_requests(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS service_requests_tenant_code_idx ON service_requests(tenant_id, service_code);`;
    await sql`CREATE INDEX IF NOT EXISTS service_requests_tenant_category_idx ON service_requests(tenant_id, service_category);`;

    // 27. Lab Test Catalog
    await sql`
      CREATE TABLE IF NOT EXISTS lab_test_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        test_code VARCHAR(64) NOT NULL,
        coding_system VARCHAR(64) DEFAULT 'LOINC' NOT NULL,
        test_name VARCHAR(255) NOT NULL,
        department VARCHAR(64) NOT NULL,
        specimen_type VARCHAR(64) NOT NULL,
        container_type VARCHAR(64) NOT NULL,
        target_tat_minutes INTEGER DEFAULT 60 NOT NULL,
        methodology VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_test_catalog_code_idx ON lab_test_catalog(test_code);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_test_catalog_dept_idx ON lab_test_catalog(department);`;

    // 28. Lab Reference Ranges
    await sql`
      CREATE TABLE IF NOT EXISTS lab_reference_ranges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE,
        gender VARCHAR(16) DEFAULT 'ANY' NOT NULL,
        age_min_days INTEGER DEFAULT 0 NOT NULL,
        age_max_days INTEGER DEFAULT 43800 NOT NULL,
        low_numeric NUMERIC(12, 4),
        high_numeric NUMERIC(12, 4),
        critical_low_numeric NUMERIC(12, 4),
        critical_high_numeric NUMERIC(12, 4),
        unit VARCHAR(64) NOT NULL,
        textual_range VARCHAR(255),
        source VARCHAR(255) NOT NULL,
        source_version VARCHAR(64) NOT NULL,
        effective_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_ref_ranges_catalog_idx ON lab_reference_ranges(test_catalog_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_ref_ranges_gender_idx ON lab_reference_ranges(gender);`;

    // 29. Lab Specimens
    await sql`
      CREATE TABLE IF NOT EXISTS lab_specimens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        accession_number VARCHAR(64) NOT NULL,
        barcode VARCHAR(128) NOT NULL,
        specimen_type VARCHAR(64) NOT NULL,
        container_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING_COLLECTION' NOT NULL,
        collected_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        collected_at TIMESTAMPTZ,
        received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        received_at TIMESTAMPTZ,
        rejection_reason VARCHAR(64),
        rejected_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        rejected_at TIMESTAMPTZ,
        rejection_notes TEXT,
        recollection_required BOOLEAN DEFAULT FALSE NOT NULL,
        recollection_specimen_id UUID,
        collection_site VARCHAR(128),
        volume_ml NUMERIC(8, 2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT lab_specimens_tenant_accession_uniq UNIQUE (tenant_id, accession_number),
        CONSTRAINT lab_specimens_tenant_barcode_uniq UNIQUE (tenant_id, barcode)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_specimens_tenant_order_idx ON lab_specimens(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_specimens_tenant_patient_idx ON lab_specimens(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_specimens_tenant_status_idx ON lab_specimens(tenant_id, status);`;

    // 30. Lab Results
    await sql`
      CREATE TABLE IF NOT EXISTS lab_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        specimen_id UUID NOT NULL REFERENCES lab_specimens(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE SET NULL,
        test_code VARCHAR(64) NOT NULL,
        test_name VARCHAR(255) NOT NULL,
        department VARCHAR(64) NOT NULL,
        numeric_value NUMERIC(12, 4),
        text_value TEXT,
        unit VARCHAR(64),
        reference_range_low NUMERIC(12, 4),
        reference_range_high NUMERIC(12, 4),
        reference_range_text VARCHAR(255),
        reference_source VARCHAR(255),
        reference_source_version VARCHAR(64),
        abnormal_flag VARCHAR(32) DEFAULT 'NORMAL' NOT NULL,
        technologist_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        entered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        verified_at TIMESTAMPTZ,
        verifier_role VARCHAR(64),
        verification_signature TEXT,
        status VARCHAR(32) DEFAULT 'PRELIMINARY' NOT NULL,
        corrected_from_id UUID,
        correction_reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_results_tenant_specimen_idx ON lab_results(tenant_id, specimen_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_results_tenant_order_idx ON lab_results(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_results_tenant_catalog_idx ON lab_results(tenant_id, test_catalog_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_results_tenant_status_idx ON lab_results(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_results_tenant_abnormal_idx ON lab_results(tenant_id, abnormal_flag);`;

    // 31. Diagnostic Reports
    await sql`
      CREATE TABLE IF NOT EXISTS diagnostic_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        report_number VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'PRELIMINARY' NOT NULL,
        title VARCHAR(255) NOT NULL,
        conclusion TEXT,
        issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        performer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        authorizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        authorized_at TIMESTAMPTZ,
        authorization_signature TEXT,
        amended_from_id UUID,
        amendment_reason TEXT,
        results_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT diagnostic_reports_tenant_number_uniq UNIQUE (tenant_id, report_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS diagnostic_reports_tenant_order_idx ON diagnostic_reports(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnostic_reports_tenant_encounter_idx ON diagnostic_reports(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnostic_reports_tenant_patient_idx ON diagnostic_reports(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS diagnostic_reports_tenant_status_idx ON diagnostic_reports(tenant_id, status);`;

    // 32. Lab Consumables
    await sql`
      CREATE TABLE IF NOT EXISTS lab_consumables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        item_code VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL,
        quantity_on_hand INTEGER DEFAULT 0 NOT NULL,
        reorder_level INTEGER DEFAULT 10 NOT NULL,
        unit_of_measure VARCHAR(32) NOT NULL,
        lot_number VARCHAR(64),
        expiry_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT lab_consumables_tenant_facility_code_uniq UNIQUE (tenant_id, facility_id, item_code)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_consumables_tenant_category_idx ON lab_consumables(tenant_id, category);`;

    // 33. Lab Consumable Deductions
    await sql`
      CREATE TABLE IF NOT EXISTS lab_consumable_deductions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        consumable_id UUID NOT NULL REFERENCES lab_consumables(id) ON DELETE CASCADE,
        specimen_id UUID REFERENCES lab_specimens(id) ON DELETE SET NULL,
        order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
        quantity_deducted INTEGER DEFAULT 1 NOT NULL,
        reason VARCHAR(64) NOT NULL,
        deducted_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        deducted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS lab_deductions_tenant_consumable_idx ON lab_consumable_deductions(tenant_id, consumable_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_deductions_tenant_specimen_idx ON lab_consumable_deductions(tenant_id, specimen_id);`;
    await sql`CREATE INDEX IF NOT EXISTS lab_deductions_tenant_order_idx ON lab_consumable_deductions(tenant_id, order_id);`;

    // 34. Pharmacy Products
    await sql`
      CREATE TABLE IF NOT EXISTS pharmacy_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        item_code VARCHAR(64) NOT NULL,
        generic_name VARCHAR(255) NOT NULL,
        brand_name VARCHAR(255),
        atc_code VARCHAR(32),
        keml_category VARCHAR(64),
        drug_schedule VARCHAR(32) DEFAULT 'PART_1_POISON' NOT NULL,
        category VARCHAR(64) DEFAULT 'ORAL_SOLID' NOT NULL,
        form VARCHAR(64) NOT NULL,
        strength VARCHAR(64) NOT NULL,
        strength_unit VARCHAR(32) NOT NULL,
        dispensing_unit VARCHAR(32) DEFAULT 'TABLET' NOT NULL,
        packaging_unit VARCHAR(32) DEFAULT 'BLISTER_PACK' NOT NULL,
        packaging_size INTEGER DEFAULT 1 NOT NULL,
        storage_condition VARCHAR(32) DEFAULT 'ROOM_TEMPERATURE' NOT NULL,
        unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        reorder_level INTEGER DEFAULT 50 NOT NULL,
        max_stock_level INTEGER DEFAULT 1000,
        prescription_required BOOLEAN DEFAULT TRUE NOT NULL,
        controlled_substance BOOLEAN DEFAULT FALSE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_code_idx ON pharmacy_products(item_code);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_generic_idx ON pharmacy_products(generic_name);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_atc_idx ON pharmacy_products(atc_code);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_schedule_idx ON pharmacy_products(drug_schedule);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_category_idx ON pharmacy_products(category);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_products_tenant_idx ON pharmacy_products(tenant_id);`;

    // 35. Pharmacy Suppliers
    await sql`
      CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        supplier_code VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        ppb_license_number VARCHAR(128),
        kra_pin VARCHAR(64),
        contact_person VARCHAR(128),
        email VARCHAR(255),
        phone VARCHAR(64),
        physical_address TEXT,
        lead_time_days INTEGER DEFAULT 7 NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT pharmacy_suppliers_tenant_code_uniq UNIQUE (tenant_id, supplier_code)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_suppliers_tenant_active_idx ON pharmacy_suppliers(tenant_id, is_active);`;

    // 36. Pharmacy Batches
    await sql`
      CREATE TABLE IF NOT EXISTS pharmacy_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
        batch_number VARCHAR(64) NOT NULL,
        manufacturer VARCHAR(255),
        manufactured_date TIMESTAMPTZ,
        expiry_date TIMESTAMPTZ NOT NULL,
        quantity_received INTEGER DEFAULT 0 NOT NULL,
        quantity_on_hand INTEGER DEFAULT 0 NOT NULL,
        quantity_reserved INTEGER DEFAULT 0 NOT NULL,
        unit_cost NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        selling_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        storage_bin VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT pharmacy_batches_tenant_facility_prod_batch_uniq UNIQUE (tenant_id, facility_id, product_id, batch_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_batches_tenant_facility_expiry_idx ON pharmacy_batches(tenant_id, facility_id, expiry_date);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_batches_tenant_prod_status_idx ON pharmacy_batches(tenant_id, product_id, status);`;

    // 37. Pharmacy Stock Movements
    await sql`
      CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
        batch_id UUID REFERENCES pharmacy_batches(id) ON DELETE SET NULL,
        movement_type VARCHAR(64) NOT NULL,
        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        unit_cost NUMERIC(12, 2),
        reference_type VARCHAR(64),
        reference_id UUID,
        supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
        destination_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        reason VARCHAR(255),
        notes TEXT,
        performed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        movement_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_movements_tenant_facility_idx ON pharmacy_stock_movements(tenant_id, facility_id);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_movements_tenant_product_idx ON pharmacy_stock_movements(tenant_id, product_id);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_movements_tenant_batch_idx ON pharmacy_stock_movements(tenant_id, batch_id);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_movements_tenant_type_idx ON pharmacy_stock_movements(tenant_id, movement_type);`;
    await sql`CREATE INDEX IF NOT EXISTS pharmacy_movements_tenant_date_idx ON pharmacy_stock_movements(tenant_id, movement_date);`;

    // 38. Medication Dispenses
    await sql`
      CREATE TABLE IF NOT EXISTS medication_dispenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
        medication_request_id UUID NOT NULL REFERENCES medication_requests(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        dispense_number VARCHAR(64) NOT NULL,
        status VARCHAR(32) DEFAULT 'PREPARATION' NOT NULL,
        dispense_type VARCHAR(32) DEFAULT 'FULL' NOT NULL,
        quantity_prescribed INTEGER NOT NULL,
        quantity_dispensed INTEGER DEFAULT 0 NOT NULL,
        quantity_remaining INTEGER DEFAULT 0 NOT NULL,
        days_supply INTEGER,
        dosage_instructions TEXT,
        dispenser_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        dispensed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        authorized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        substitution_reason TEXT,
        patient_counseling_notes TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT med_dispenses_tenant_number_uniq UNIQUE (tenant_id, dispense_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS med_dispenses_tenant_order_idx ON medication_dispenses(tenant_id, order_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_dispenses_tenant_med_req_idx ON medication_dispenses(tenant_id, medication_request_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_dispenses_tenant_patient_idx ON medication_dispenses(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_dispenses_tenant_status_idx ON medication_dispenses(tenant_id, status);`;

    // 39. Medication Dispense Items
    await sql`
      CREATE TABLE IF NOT EXISTS medication_dispense_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        dispense_id UUID NOT NULL REFERENCES medication_dispenses(id) ON DELETE CASCADE,
        batch_id UUID NOT NULL REFERENCES pharmacy_batches(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
        quantity_dispensed INTEGER NOT NULL,
        unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS dispense_items_tenant_dispense_idx ON medication_dispense_items(tenant_id, dispense_id);`;
    await sql`CREATE INDEX IF NOT EXISTS dispense_items_tenant_batch_idx ON medication_dispense_items(tenant_id, batch_id);`;
    await sql`CREATE INDEX IF NOT EXISTS dispense_items_tenant_product_idx ON medication_dispense_items(tenant_id, product_id);`;

    // 40. Medication Administrations
    await sql`
      CREATE TABLE IF NOT EXISTS medication_administrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        dispense_id UUID REFERENCES medication_dispenses(id) ON DELETE SET NULL,
        medication_request_id UUID NOT NULL REFERENCES medication_requests(id) ON DELETE CASCADE,
        encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        administrator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        administered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        status VARCHAR(32) DEFAULT 'COMPLETED' NOT NULL,
        dose_quantity NUMERIC(10, 2) NOT NULL,
        dose_unit VARCHAR(32) NOT NULL,
        route VARCHAR(32) DEFAULT 'ORAL' NOT NULL,
        site VARCHAR(128),
        reason_not_administered TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS med_admin_tenant_encounter_idx ON medication_administrations(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_admin_tenant_patient_idx ON medication_administrations(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_admin_tenant_med_req_idx ON medication_administrations(tenant_id, medication_request_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_admin_tenant_dispense_idx ON medication_administrations(tenant_id, dispense_id);`;
    await sql`CREATE INDEX IF NOT EXISTS med_admin_tenant_status_idx ON medication_administrations(tenant_id, status);`;

    // 41. Billing Service Catalogue
    await sql`
      CREATE TABLE IF NOT EXISTS billing_service_catalogue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
        service_code VARCHAR(64) NOT NULL,
        service_name VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL,
        department VARCHAR(64) NOT NULL,
        base_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        tax_rate NUMERIC(6, 4) DEFAULT 0.0000 NOT NULL,
        tax_code VARCHAR(16) DEFAULT 'E' NOT NULL,
        clinical_code VARCHAR(64),
        clinical_coding_system VARCHAR(64),
        sha_covered BOOLEAN DEFAULT FALSE NOT NULL,
        sha_standard_tariff NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        preauthorization_required BOOLEAN DEFAULT FALSE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS billing_services_code_idx ON billing_service_catalogue(service_code);`;
    await sql`CREATE INDEX IF NOT EXISTS billing_services_tenant_idx ON billing_service_catalogue(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS billing_services_cat_idx ON billing_service_catalogue(category);`;

    // 42. Invoices
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        invoice_number VARCHAR(64) NOT NULL,
        invoice_type VARCHAR(32) DEFAULT 'ORIGINAL' NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        payer_type VARCHAR(32) DEFAULT 'OUT_OF_POCKET' NOT NULL,
        sha_fund_type VARCHAR(32),
        sha_claim_reference VARCHAR(64),
        currency VARCHAR(8) DEFAULT 'KES' NOT NULL,
        subtotal_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        tax_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        sha_portion_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        patient_portion_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        paid_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        balance_due NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        is_simulated BOOLEAN DEFAULT FALSE NOT NULL,
        etims_status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
        etims_control_code VARCHAR(128),
        etims_qr_code TEXT,
        etims_signed_at TIMESTAMPTZ,
        finalized_at TIMESTAMPTZ,
        finalized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        cancelled_at TIMESTAMPTZ,
        cancelled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        cancellation_reason TEXT,
        credit_note_invoice_id UUID,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT invoices_tenant_number_uniq UNIQUE (tenant_id, invoice_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS invoices_tenant_patient_idx ON invoices(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS invoices_tenant_encounter_idx ON invoices(tenant_id, encounter_id);`;
    await sql`CREATE INDEX IF NOT EXISTS invoices_tenant_status_idx ON invoices(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS invoices_tenant_etims_idx ON invoices(tenant_id, etims_status);`;

    // 43. Invoice Line Items
    await sql`
      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        billing_service_id UUID REFERENCES billing_service_catalogue(id) ON DELETE SET NULL,
        source_type VARCHAR(64) DEFAULT 'MANUAL' NOT NULL,
        source_reference_id UUID,
        item_code VARCHAR(64) NOT NULL,
        item_description VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL,
        quantity NUMERIC(10, 2) DEFAULT 1.00 NOT NULL,
        unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        gross_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        tax_rate NUMERIC(6, 4) DEFAULT 0.0000 NOT NULL,
        tax_code VARCHAR(16) DEFAULT 'E' NOT NULL,
        tax_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        net_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        sha_coverage_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        patient_payable_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`ALTER TABLE billing_service_catalogue ALTER COLUMN tax_rate TYPE NUMERIC(6, 4);`;
    await sql`ALTER TABLE invoice_line_items ALTER COLUMN tax_rate TYPE NUMERIC(6, 4);`;
    await sql`CREATE INDEX IF NOT EXISTS invoice_items_tenant_invoice_idx ON invoice_line_items(tenant_id, invoice_id);`;
    await sql`CREATE INDEX IF NOT EXISTS invoice_items_tenant_source_idx ON invoice_line_items(tenant_id, source_type, source_reference_id);`;

    // 44. Invoice Adjustments
    await sql`
      CREATE TABLE IF NOT EXISTS invoice_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL,
        adjustment_type VARCHAR(32) NOT NULL,
        requested_amount NUMERIC(12, 2) NOT NULL,
        approved_amount NUMERIC(12, 2),
        reason TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING_APPROVAL' NOT NULL,
        requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`ALTER TABLE invoice_adjustments ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12, 2);`;
    await sql`CREATE INDEX IF NOT EXISTS adjustments_tenant_invoice_idx ON invoice_adjustments(tenant_id, invoice_id);`;
    await sql`CREATE INDEX IF NOT EXISTS adjustments_tenant_status_idx ON invoice_adjustments(tenant_id, status);`;

    // 45. Payments
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        payment_number VARCHAR(64) NOT NULL,
        receipt_number VARCHAR(64) NOT NULL,
        payment_method VARCHAR(32) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(8) DEFAULT 'KES' NOT NULL,
        status VARCHAR(32) DEFAULT 'COMPLETED' NOT NULL,
        payment_reference VARCHAR(128),
        idempotency_key VARCHAR(128) NOT NULL,
        is_simulated BOOLEAN DEFAULT FALSE NOT NULL,
        received_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT payments_tenant_number_uniq UNIQUE (tenant_id, payment_number),
        CONSTRAINT payments_tenant_receipt_uniq UNIQUE (tenant_id, receipt_number),
        CONSTRAINT payments_tenant_idempotency_uniq UNIQUE (tenant_id, idempotency_key)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS payments_tenant_patient_idx ON payments(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS payments_tenant_method_idx ON payments(tenant_id, payment_method);`;

    // 46. Payment Allocations
    await sql`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount_allocated NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS allocations_tenant_payment_idx ON payment_allocations(tenant_id, payment_id);`;
    await sql`CREATE INDEX IF NOT EXISTS allocations_tenant_invoice_idx ON payment_allocations(tenant_id, invoice_id);`;

    // 47. Payment Reversals
    await sql`
      CREATE TABLE IF NOT EXISTS payment_reversals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        reversal_number VARCHAR(64) NOT NULL,
        reversal_type VARCHAR(32) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'APPROVED' NOT NULL,
        requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        authorized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        authorized_at TIMESTAMPTZ,
        refund_method VARCHAR(32) DEFAULT 'CASH' NOT NULL,
        refund_reference VARCHAR(128),
        credit_note_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT reversals_tenant_number_uniq UNIQUE (tenant_id, reversal_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS reversals_tenant_payment_idx ON payment_reversals(tenant_id, payment_id);`;

    // 48. Daily Reconciliations
    await sql`
      CREATE TABLE IF NOT EXISTS daily_reconciliations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        shift_number VARCHAR(64) NOT NULL,
        shift_date VARCHAR(32) NOT NULL,
        opened_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        closed_at TIMESTAMPTZ,
        opening_float NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        expected_cash NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        counted_cash NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        cash_discrepancy NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_mpesa NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_card NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_bank NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_other NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_collections NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_refunds NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        net_collections NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        status VARCHAR(32) DEFAULT 'OPEN' NOT NULL,
        supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        supervisor_notes TEXT,
        cashier_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT reconciliations_tenant_shift_uniq UNIQUE (tenant_id, shift_number)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS reconciliations_tenant_cashier_idx ON daily_reconciliations(tenant_id, cashier_id);`;
    await sql`CREATE INDEX IF NOT EXISTS reconciliations_tenant_status_idx ON daily_reconciliations(tenant_id, status);`;

    // 49. SHA Preauthorizations
    await sql`
      CREATE TABLE IF NOT EXISTS sha_preauthorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        preauth_number VARCHAR(64) NOT NULL UNIQUE,
        preauth_type VARCHAR(32) NOT NULL,
        fund VARCHAR(32) NOT NULL,
        sub_benefit_code VARCHAR(64) NOT NULL,
        intervention_code VARCHAR(64) NOT NULL,
        requested_amount_kes NUMERIC(12, 2) NOT NULL,
        approved_amount_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        clinical_summary TEXT NOT NULL,
        practitioner_puid VARCHAR(64) NOT NULL,
        supporting_document_urls JSONB,
        sha_reference_id VARCHAR(100),
        decision_reason TEXT,
        requested_by_id UUID NOT NULL REFERENCES users(id),
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_preauth_tenant_idx ON sha_preauthorizations(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_preauth_facility_idx ON sha_preauthorizations(facility_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_preauth_patient_idx ON sha_preauthorizations(patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_preauth_status_idx ON sha_preauthorizations(status);`;

    // 50. SHA Claims
    await sql`
      CREATE TABLE IF NOT EXISTS sha_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        claim_number VARCHAR(64) NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
        preauth_id UUID REFERENCES sha_preauthorizations(id) ON DELETE SET NULL,
        fund VARCHAR(32) NOT NULL,
        scenario VARCHAR(32) NOT NULL,
        access_point VARCHAR(32) NOT NULL,
        payment_mechanism VARCHAR(32) NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        service_start_date TIMESTAMPTZ NOT NULL,
        service_end_date TIMESTAMPTZ,
        total_claim_amount_kes NUMERIC(12, 2) NOT NULL,
        approved_amount_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        patient_copay_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        deduction_amount_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        sha_visit_id VARCHAR(100),
        sha_tracking_number VARCHAR(100),
        sha_batch_id VARCHAR(100),
        submission_fingerprint VARCHAR(100),
        rejection_reason TEXT,
        rejection_codes JSONB,
        original_claim_id UUID,
        resubmission_count INTEGER DEFAULT 0 NOT NULL,
        discharge_info JSONB,
        dispensing_info JSONB,
        submitted_at TIMESTAMPTZ,
        adjudicated_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT sha_claims_tenant_number_version_uniq UNIQUE (tenant_id, claim_number, version)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_claims_tenant_idx ON sha_claims(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_claims_facility_idx ON sha_claims(facility_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_claims_patient_idx ON sha_claims(patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_claims_status_idx ON sha_claims(status);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_claims_fund_scenario_idx ON sha_claims(fund, scenario);`;

    // 51. SHA Claim Items
    await sql`
      CREATE TABLE IF NOT EXISTS sha_claim_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        claim_id UUID NOT NULL REFERENCES sha_claims(id) ON DELETE CASCADE,
        line_type VARCHAR(32) NOT NULL,
        code VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        quantity NUMERIC(10, 2) DEFAULT 1.00 NOT NULL,
        unit_price_kes NUMERIC(12, 2) NOT NULL,
        total_amount_kes NUMERIC(12, 2) NOT NULL,
        approved_amount_kes NUMERIC(12, 2),
        status VARCHAR(32) DEFAULT 'INCLUDED' NOT NULL,
        service_date TIMESTAMPTZ NOT NULL,
        practitioner_puid VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_claim_items_tenant_idx ON sha_claim_items(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_claim_items_claim_idx ON sha_claim_items(claim_id);`;

    // 52. SHA Claim Submissions
    await sql`
      CREATE TABLE IF NOT EXISTS sha_claim_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        claim_id UUID NOT NULL REFERENCES sha_claims(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        submission_type VARCHAR(32) DEFAULT 'INITIAL' NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        trace_id VARCHAR(100),
        payload_digest VARCHAR(100) NOT NULL,
        request_payload_redacted JSONB NOT NULL,
        response_payload JSONB,
        http_status INTEGER,
        outcome VARCHAR(32) NOT NULL,
        error_message TEXT,
        submitted_by_id UUID REFERENCES users(id),
        submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_submissions_tenant_idx ON sha_claim_submissions(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_submissions_claim_idx ON sha_claim_submissions(claim_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_submissions_correlation_idx ON sha_claim_submissions(correlation_id);`;

    // 53. SHA Claim Attachments
    await sql`
      CREATE TABLE IF NOT EXISTS sha_claim_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        claim_id UUID NOT NULL REFERENCES sha_claims(id) ON DELETE CASCADE,
        preauth_id UUID REFERENCES sha_preauthorizations(id),
        document_type VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        mime_type VARCHAR(64) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        sha_attachment_id VARCHAR(100),
        file_size_bytes INTEGER,
        sha_upload_status VARCHAR(32) DEFAULT 'LOCAL_ONLY' NOT NULL,
        uploaded_by_id UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_attachments_tenant_idx ON sha_claim_attachments(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_attachments_claim_idx ON sha_claim_attachments(claim_id);`;

    // 54. SHA Callback Events
    await sql`
      CREATE TABLE IF NOT EXISTS sha_callback_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_type VARCHAR(64) NOT NULL,
        claim_number VARCHAR(64),
        preauth_number VARCHAR(64),
        external_reference VARCHAR(100),
        trace_id VARCHAR(100),
        raw_payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE NOT NULL,
        processed_at TIMESTAMPTZ,
        processing_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS sha_callbacks_tenant_idx ON sha_callback_events(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_callbacks_type_idx ON sha_callback_events(event_type);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_callbacks_claim_idx ON sha_callback_events(claim_number);`;
    await sql`CREATE INDEX IF NOT EXISTS sha_callbacks_processed_idx ON sha_callback_events(processed);`;

    // Ensure SHA claims foreign keys have ON DELETE CASCADE / SET NULL
    await sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sha_claims_encounter_id_fkey') THEN
          ALTER TABLE sha_claims DROP CONSTRAINT sha_claims_encounter_id_fkey;
        END IF;
        ALTER TABLE sha_claims ADD CONSTRAINT sha_claims_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sha_claims_invoice_id_fkey') THEN
          ALTER TABLE sha_claims DROP CONSTRAINT sha_claims_invoice_id_fkey;
        END IF;
        ALTER TABLE sha_claims ADD CONSTRAINT sha_claims_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sha_claims_preauth_id_fkey') THEN
          ALTER TABLE sha_claims DROP CONSTRAINT sha_claims_preauth_id_fkey;
        END IF;
        ALTER TABLE sha_claims ADD CONSTRAINT sha_claims_preauth_id_fkey FOREIGN KEY (preauth_id) REFERENCES sha_preauthorizations(id) ON DELETE SET NULL;
      END $$;
    `;

    // 55. Wards
    await sql`
      CREATE TABLE IF NOT EXISTS wards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender_restriction VARCHAR(32) DEFAULT 'NONE' NOT NULL,
        specialty VARCHAR(64) DEFAULT 'GENERAL' NOT NULL,
        floor_location VARCHAR(100),
        total_beds INTEGER DEFAULT 0 NOT NULL,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS wards_tenant_facility_idx ON wards(tenant_id, facility_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS wards_tenant_code_idx ON wards(tenant_id, facility_id, code);`;

    // 56. Beds
    await sql`
      CREATE TABLE IF NOT EXISTS beds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
        bed_number VARCHAR(32) NOT NULL,
        room_number VARCHAR(32),
        bed_type VARCHAR(32) DEFAULT 'STANDARD' NOT NULL,
        status VARCHAR(32) DEFAULT 'VACANT' NOT NULL,
        daily_rate NUMERIC(10, 2) DEFAULT '0.00' NOT NULL,
        current_admission_id UUID,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS beds_tenant_ward_idx ON beds(tenant_id, ward_id);`;
    await sql`CREATE INDEX IF NOT EXISTS beds_tenant_status_idx ON beds(tenant_id, status);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS beds_tenant_ward_number_idx ON beds(tenant_id, ward_id, bed_number);`;

    // 57. Inpatient Admissions
    await sql`
      CREATE TABLE IF NOT EXISTS inpatient_admissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        admission_number VARCHAR(64) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        admitting_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        attending_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        admission_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        admission_type VARCHAR(32) DEFAULT 'EMERGENCY' NOT NULL,
        admission_diagnosis_icd11 VARCHAR(64) NOT NULL,
        admission_diagnosis_title VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'ADMITTED' NOT NULL,
        current_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
        current_bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
        preauthorization_number VARCHAR(64),
        discharge_date TIMESTAMPTZ,
        discharge_disposition VARCHAR(64),
        final_diagnosis_icd11 VARCHAR(64),
        final_diagnosis_title VARCHAR(255),
        discharge_summary_notes TEXT,
        discharged_by_practitioner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        cancelled_at TIMESTAMPTZ,
        cancellation_reason TEXT,
        cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS admissions_tenant_number_idx ON inpatient_admissions(tenant_id, admission_number);`;
    await sql`CREATE INDEX IF NOT EXISTS admissions_tenant_patient_idx ON inpatient_admissions(tenant_id, patient_id);`;
    await sql`CREATE INDEX IF NOT EXISTS admissions_tenant_status_idx ON inpatient_admissions(tenant_id, status);`;

    // 58. Inpatient Bed Transfers
    await sql`
      CREATE TABLE IF NOT EXISTS inpatient_bed_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        admission_id UUID NOT NULL REFERENCES inpatient_admissions(id) ON DELETE CASCADE,
        from_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
        from_bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
        to_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
        to_bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
        transfer_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        reason TEXT NOT NULL,
        authorized_by_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS bed_transfers_tenant_admission_idx ON inpatient_bed_transfers(tenant_id, admission_id);`;

    // 59. Theatres
    await sql`
      CREATE TABLE IF NOT EXISTS theatres (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        theatre_type VARCHAR(32) DEFAULT 'MAJOR' NOT NULL,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS theatres_tenant_facility_idx ON theatres(tenant_id, facility_id);`;

    // 60. Theatre Bookings
    await sql`
      CREATE TABLE IF NOT EXISTS theatre_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        booking_number VARCHAR(64) NOT NULL,
        theatre_id UUID NOT NULL REFERENCES theatres(id) ON DELETE RESTRICT,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        admission_id UUID REFERENCES inpatient_admissions(id) ON DELETE SET NULL,
        lead_surgeon_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        anesthetist_id UUID REFERENCES users(id) ON DELETE SET NULL,
        procedure_code VARCHAR(64) NOT NULL,
        procedure_name VARCHAR(255) NOT NULL,
        urgency VARCHAR(32) DEFAULT 'ELECTIVE' NOT NULL,
        status VARCHAR(32) DEFAULT 'SCHEDULED' NOT NULL,
        scheduled_start_time TIMESTAMPTZ NOT NULL,
        scheduled_end_time TIMESTAMPTZ NOT NULL,
        actual_start_time TIMESTAMPTZ,
        actual_end_time TIMESTAMPTZ,
        cancellation_reason TEXT,
        cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        preop_checklist_completed BOOLEAN DEFAULT FALSE NOT NULL,
        time_out_completed BOOLEAN DEFAULT FALSE NOT NULL,
        sign_out_completed BOOLEAN DEFAULT FALSE NOT NULL,
        who_checklist_data JSONB,
        anesthesia_notes TEXT,
        operative_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS theatre_bookings_tenant_number_idx ON theatre_bookings(tenant_id, booking_number);`;
    await sql`CREATE INDEX IF NOT EXISTS theatre_bookings_theatre_time_idx ON theatre_bookings(tenant_id, theatre_id, scheduled_start_time);`;

    // 61. Maternity Deliveries
    await sql`
      CREATE TABLE IF NOT EXISTS maternity_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        mother_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        admission_id UUID REFERENCES inpatient_admissions(id) ON DELETE SET NULL,
        delivery_number VARCHAR(64) NOT NULL,
        gravida INTEGER DEFAULT 1 NOT NULL,
        parity INTEGER DEFAULT 0 NOT NULL,
        gestational_age_weeks NUMERIC(4, 1),
        delivery_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        delivery_mode VARCHAR(32) DEFAULT 'SPONTANEOUS_VAGINAL' NOT NULL,
        delivery_outcome VARCHAR(32) DEFAULT 'LIVE_BIRTH' NOT NULL,
        perineal_tear VARCHAR(32) DEFAULT 'NONE' NOT NULL,
        estimated_blood_loss_ml INTEGER,
        delivering_clinician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        partograph_summary JSONB,
        complications TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS maternity_deliveries_tenant_num_idx ON maternity_deliveries(tenant_id, delivery_number);`;
    await sql`CREATE INDEX IF NOT EXISTS maternity_deliveries_tenant_mother_idx ON maternity_deliveries(tenant_id, mother_patient_id);`;

    // 62. Newborn Profiles
    await sql`
      CREATE TABLE IF NOT EXISTS newborn_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        delivery_id UUID NOT NULL REFERENCES maternity_deliveries(id) ON DELETE CASCADE,
        mother_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        birth_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        birth_order INTEGER DEFAULT 1 NOT NULL,
        gender VARCHAR(32) DEFAULT 'INDETERMINATE' NOT NULL,
        birth_weight_grams INTEGER NOT NULL,
        birth_length_cm NUMERIC(4, 1),
        head_circumference_cm NUMERIC(4, 1),
        apgar_score_1min INTEGER NOT NULL,
        apgar_score_5min INTEGER NOT NULL,
        apgar_score_10min INTEGER,
        resuscitation_required BOOLEAN DEFAULT FALSE NOT NULL,
        birth_notification_number VARCHAR(64),
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS newborn_profiles_tenant_delivery_idx ON newborn_profiles(tenant_id, delivery_id);`;
    await sql`CREATE INDEX IF NOT EXISTS newborn_profiles_tenant_mother_idx ON newborn_profiles(tenant_id, mother_patient_id);`;

    // 63. Radiology Orders
    await sql`
      CREATE TABLE IF NOT EXISTS radiology_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        order_number VARCHAR(64) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        ordering_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        modality VARCHAR(32) DEFAULT 'XRAY' NOT NULL,
        procedure_code VARCHAR(64) NOT NULL,
        procedure_name VARCHAR(255) NOT NULL,
        body_site VARCHAR(100) NOT NULL,
        clinical_indication TEXT NOT NULL,
        is_confidential_specialist BOOLEAN DEFAULT FALSE NOT NULL,
        urgency VARCHAR(32) DEFAULT 'ROUTINE' NOT NULL,
        status VARCHAR(32) DEFAULT 'REQUESTED' NOT NULL,
        scheduled_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancellation_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS radiology_orders_tenant_number_idx ON radiology_orders(tenant_id, order_number);`;
    await sql`CREATE INDEX IF NOT EXISTS radiology_orders_tenant_patient_idx ON radiology_orders(tenant_id, patient_id);`;

    // 64. Radiology Reports
    await sql`
      CREATE TABLE IF NOT EXISTS radiology_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES radiology_orders(id) ON DELETE CASCADE,
        report_number VARCHAR(64) NOT NULL,
        radiologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        findings TEXT NOT NULL,
        impression TEXT NOT NULL,
        recommendations TEXT,
        critical_result BOOLEAN DEFAULT FALSE NOT NULL,
        critical_result_notified_to VARCHAR(255),
        critical_result_notified_at TIMESTAMPTZ,
        pacs_study_uid VARCHAR(128),
        pacs_accession_number VARCHAR(64),
        pacs_viewer_url TEXT,
        signed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        addendum_notes TEXT,
        status VARCHAR(32) DEFAULT 'FINAL' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS radiology_reports_tenant_number_idx ON radiology_reports(tenant_id, report_number);`;
    await sql`CREATE INDEX IF NOT EXISTS radiology_reports_tenant_order_idx ON radiology_reports(tenant_id, order_id);`;

    // 65. Referrals & Counter-Referrals
    await sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        referral_number VARCHAR(64) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        referral_direction VARCHAR(32) DEFAULT 'OUTBOUND' NOT NULL,
        referring_facility_kmfl VARCHAR(32) NOT NULL,
        referring_facility_name VARCHAR(255) NOT NULL,
        receiving_facility_kmfl VARCHAR(32) NOT NULL,
        receiving_facility_name VARCHAR(255) NOT NULL,
        referring_practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        referring_practitioner_name VARCHAR(255) NOT NULL,
        specialty_requested VARCHAR(64) NOT NULL,
        clinical_summary TEXT NOT NULL,
        reason_for_referral TEXT NOT NULL,
        priority VARCHAR(32) DEFAULT 'ROUTINE' NOT NULL,
        status VARCHAR(32) DEFAULT 'DISPATCHED' NOT NULL,
        transport_type VARCHAR(32) DEFAULT 'AMBULANCE' NOT NULL,
        ambulance_details JSONB,
        dispatched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        accepted_at TIMESTAMPTZ,
        counter_referral_notes TEXT,
        counter_referral_practitioner_name VARCHAR(255),
        counter_referral_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS referrals_tenant_number_idx ON referrals(tenant_id, referral_number);`;
    await sql`CREATE INDEX IF NOT EXISTS referrals_tenant_patient_idx ON referrals(tenant_id, patient_id);`;

    // 66. Appointments & Scheduling
    await sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        appointment_number VARCHAR(64) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        department VARCHAR(64),
        service_type VARCHAR(64) DEFAULT 'GENERAL_CONSULTATION' NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        duration_minutes INTEGER DEFAULT 30 NOT NULL,
        status VARCHAR(32) DEFAULT 'SCHEDULED' NOT NULL,
        reason TEXT NOT NULL,
        cancellation_reason TEXT,
        cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        check_in_time TIMESTAMPTZ,
        reminder_sent BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS appointments_tenant_number_idx ON appointments(tenant_id, appointment_number);`;
    await sql`CREATE INDEX IF NOT EXISTS appointments_practitioner_time_idx ON appointments(tenant_id, practitioner_id, start_time);`;
    await sql`CREATE INDEX IF NOT EXISTS appointments_tenant_patient_idx ON appointments(tenant_id, patient_id);`;

    // 67. Procurement Orders
    await sql`
      CREATE TABLE IF NOT EXISTS procurement_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        po_number VARCHAR(64) NOT NULL,
        supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
        supplier_name VARCHAR(255) NOT NULL,
        order_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        expected_delivery_date TIMESTAMPTZ,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        total_amount NUMERIC(12, 2) DEFAULT '0.00' NOT NULL,
        authorized_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS procurement_orders_tenant_number_idx ON procurement_orders(tenant_id, po_number);`;

    // 68. Procurement Order Items
    await sql`
      CREATE TABLE IF NOT EXISTS procurement_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
        item_type VARCHAR(32) DEFAULT 'MEDICATION' NOT NULL,
        item_id UUID,
        item_description VARCHAR(255) NOT NULL,
        quantity_ordered NUMERIC(12, 2) NOT NULL,
        quantity_received NUMERIC(12, 2) DEFAULT '0' NOT NULL,
        unit_price NUMERIC(12, 2) NOT NULL,
        total_price NUMERIC(12, 2) NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS procurement_items_tenant_order_idx ON procurement_order_items(tenant_id, order_id);`;

    // 69. Goods Received Notes (GRN)
    await sql`
      CREATE TABLE IF NOT EXISTS goods_received_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        grn_number VARCHAR(64) NOT NULL,
        procurement_order_id UUID NOT NULL REFERENCES procurement_orders(id) ON DELETE RESTRICT,
        supplier_invoice_number VARCHAR(64) NOT NULL,
        received_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        received_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        inspected_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        inspection_passed BOOLEAN DEFAULT TRUE NOT NULL,
        inspection_notes TEXT,
        storage_bin_location VARCHAR(64),
        status VARCHAR(32) DEFAULT 'ACCEPTED' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS grn_tenant_number_idx ON goods_received_notes(tenant_id, grn_number);`;
    await sql`CREATE INDEX IF NOT EXISTS grn_tenant_po_idx ON goods_received_notes(tenant_id, procurement_order_id);`;

    // 70. Private Insurance Policies
    await sql`
      CREATE TABLE IF NOT EXISTS insurance_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        payer_code VARCHAR(64) NOT NULL,
        payer_name VARCHAR(255) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        policy_number VARCHAR(64) NOT NULL,
        member_number VARCHAR(64) NOT NULL,
        principal_member_name VARCHAR(255) NOT NULL,
        relationship_to_principal VARCHAR(32) DEFAULT 'SELF' NOT NULL,
        benefit_scheme VARCHAR(100) NOT NULL,
        annual_limit NUMERIC(12, 2) NOT NULL,
        balance_available NUMERIC(12, 2) NOT NULL,
        copay_amount NUMERIC(10, 2) DEFAULT '0.00' NOT NULL,
        copay_percentage NUMERIC(5, 2) DEFAULT '0.00' NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        expiry_date TIMESTAMPTZ NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS insurance_policies_tenant_policy_idx ON insurance_policies(tenant_id, payer_code, member_number);`;
    await sql`CREATE INDEX IF NOT EXISTS insurance_policies_tenant_patient_idx ON insurance_policies(tenant_id, patient_id);`;

    // 71. Private Insurance Authorizations
    await sql`
      CREATE TABLE IF NOT EXISTS insurance_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
        admission_id UUID REFERENCES inpatient_admissions(id) ON DELETE SET NULL,
        auth_code VARCHAR(64) NOT NULL,
        requested_amount NUMERIC(12, 2) NOT NULL,
        approved_amount NUMERIC(12, 2) NOT NULL,
        requested_services TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
        valid_until TIMESTAMPTZ NOT NULL,
        decline_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS insurance_auth_tenant_code_idx ON insurance_authorizations(tenant_id, auth_code);`;
    await sql`CREATE INDEX IF NOT EXISTS insurance_auth_tenant_policy_idx ON insurance_authorizations(tenant_id, policy_id);`;

    // 72. Departments
    await sql`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(100) NOT NULL,
        head_of_department_id UUID REFERENCES users(id) ON DELETE SET NULL,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_code_idx ON departments(tenant_id, facility_id, code);`;

    // 73. Staff Rosters
    await sql`
      CREATE TABLE IF NOT EXISTS staff_rosters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        roster_month VARCHAR(7) NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        published_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS rosters_tenant_dept_month_idx ON staff_rosters(tenant_id, department_id, roster_month);`;

    // 74. Staff Roster Shifts
    await sql`
      CREATE TABLE IF NOT EXISTS staff_roster_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        roster_id UUID NOT NULL REFERENCES staff_rosters(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shift_date VARCHAR(10) NOT NULL,
        shift_type VARCHAR(32) DEFAULT 'MORNING' NOT NULL,
        assigned_ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
        handover_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS shifts_tenant_roster_user_date_idx ON staff_roster_shifts(tenant_id, roster_id, user_id, shift_date);`;
    await sql`CREATE INDEX IF NOT EXISTS shifts_tenant_date_type_idx ON staff_roster_shifts(tenant_id, shift_date, shift_type);`;

    // 75. Subscription Plans (Commercial Tier Catalog)
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        facility_level VARCHAR(32) NOT NULL,
        billing_cycle VARCHAR(32) DEFAULT 'MONTHLY' NOT NULL,
        base_price_kes NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(8) DEFAULT 'KES' NOT NULL,
        max_users INTEGER NOT NULL,
        max_monthly_encounters INTEGER NOT NULL,
        max_storage_gb INTEGER NOT NULL,
        features JSONB NOT NULL,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_code_idx ON subscription_plans(code);`;

    // 76. Tenant Subscriptions
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
        status VARCHAR(32) DEFAULT 'TRIAL' NOT NULL,
        billing_cycle VARCHAR(32) DEFAULT 'MONTHLY' NOT NULL,
        current_period_start TIMESTAMPTZ NOT NULL,
        current_period_end TIMESTAMPTZ NOT NULL,
        trial_ends_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancellation_reason TEXT,
        suspended_at TIMESTAMPTZ,
        suspension_reason TEXT,
        auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS tenant_subscriptions_tenant_idx ON tenant_subscriptions(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS tenant_subscriptions_status_idx ON tenant_subscriptions(status);`;

    // 77. Subscription History
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        action VARCHAR(32) NOT NULL,
        previous_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        new_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        previous_status VARCHAR(32),
        new_status VARCHAR(32),
        changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        effective_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS subscription_history_tenant_idx ON subscription_history(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS subscription_history_sub_idx ON subscription_history(subscription_id);`;

    // 78. Tenant Entitlements
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_entitlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
        max_users INTEGER NOT NULL,
        max_monthly_encounters INTEGER NOT NULL,
        max_storage_gb INTEGER NOT NULL,
        features JSONB NOT NULL,
        custom_overrides JSONB,
        enforce_hard_limits BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS tenant_entitlements_tenant_idx ON tenant_entitlements(tenant_id);`;

    // 79. Tenant Usage Meters
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_usage_meters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        metric_type VARCHAR(64) NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        quantity INTEGER DEFAULT 0 NOT NULL,
        last_recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS tenant_usage_meters_tenant_idx ON tenant_usage_meters(tenant_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS tenant_usage_meters_metric_idx ON tenant_usage_meters(tenant_id, metric_type, period_start);`;

    // 80. Platform Invoices
    await sql`
      CREATE TABLE IF NOT EXISTS platform_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
        invoice_number VARCHAR(64) NOT NULL UNIQUE,
        billing_period_start TIMESTAMPTZ NOT NULL,
        billing_period_end TIMESTAMPTZ NOT NULL,
        subtotal_kes NUMERIC(12, 2) NOT NULL,
        tax_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        total_kes NUMERIC(12, 2) NOT NULL,
        amount_paid_kes NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
        status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL,
        due_date TIMESTAMPTZ NOT NULL,
        idempotency_key VARCHAR(128) UNIQUE,
        kra_control_code VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS platform_invoices_number_idx ON platform_invoices(invoice_number);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS platform_invoices_idempotency_idx ON platform_invoices(idempotency_key);`;
    await sql`CREATE INDEX IF NOT EXISTS platform_invoices_tenant_status_idx ON platform_invoices(tenant_id, status);`;

    // 81. Platform Invoice Items
    await sql`
      CREATE TABLE IF NOT EXISTS platform_invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1 NOT NULL,
        unit_price_kes NUMERIC(12, 2) NOT NULL,
        total_price_kes NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS platform_invoice_items_invoice_idx ON platform_invoice_items(invoice_id);`;
    await sql`CREATE INDEX IF NOT EXISTS platform_invoice_items_tenant_idx ON platform_invoice_items(tenant_id);`;

    // 82. Platform Payments
    await sql`
      CREATE TABLE IF NOT EXISTS platform_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
        amount_kes NUMERIC(12, 2) NOT NULL,
        payment_method VARCHAR(32) NOT NULL,
        reference_number VARCHAR(64) NOT NULL,
        checkout_request_id VARCHAR(128),
        status VARCHAR(32) DEFAULT 'INITIATED' NOT NULL,
        idempotency_key VARCHAR(128) UNIQUE,
        failure_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS platform_payments_tenant_idx ON platform_payments(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS platform_payments_invoice_idx ON platform_payments(invoice_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS platform_payments_idempotency_idx ON platform_payments(idempotency_key);`;

    // 83. Platform Dunning Events
    await sql`
      CREATE TABLE IF NOT EXISTS platform_dunning_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
        stage VARCHAR(32) NOT NULL,
        attempt_number INTEGER DEFAULT 1 NOT NULL,
        message TEXT NOT NULL,
        action_taken VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS platform_dunning_tenant_idx ON platform_dunning_events(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS platform_dunning_sub_idx ON platform_dunning_events(subscription_id);`;

    // 84. Support Cases
    await sql`
      CREATE TABLE IF NOT EXISTS support_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        case_number VARCHAR(32) NOT NULL UNIQUE,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(64) NOT NULL,
        priority VARCHAR(32) DEFAULT 'MEDIUM' NOT NULL,
        status VARCHAR(32) DEFAULT 'OPEN' NOT NULL,
        assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS support_cases_number_idx ON support_cases(case_number);`;
    await sql`CREATE INDEX IF NOT EXISTS support_cases_tenant_status_idx ON support_cases(tenant_id, status);`;

    // 85. Support Case Messages
    await sql`
      CREATE TABLE IF NOT EXISTS support_case_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
        sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_staff BOOLEAN DEFAULT FALSE NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS support_case_messages_case_idx ON support_case_messages(case_id);`;
    await sql`CREATE INDEX IF NOT EXISTS support_case_messages_tenant_idx ON support_case_messages(tenant_id);`;

    // 86. Support Access Grants
    await sql`
      CREATE TABLE IF NOT EXISTS support_access_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        granted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        support_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        scope VARCHAR(64) DEFAULT 'READ_ONLY' NOT NULL,
        valid_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        valid_until TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS support_access_grants_tenant_idx ON support_access_grants(tenant_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS support_access_grants_token_idx ON support_access_grants(token_hash);`;

    // 87. Tenant Offboarding Requests
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_offboarding_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(32) DEFAULT 'REQUESTED' NOT NULL,
        reason TEXT NOT NULL,
        clinical_data_retention_until TIMESTAMPTZ NOT NULL,
        export_bundle_url TEXT,
        export_checksum_sha256 VARCHAR(64),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS offboarding_requests_tenant_idx ON tenant_offboarding_requests(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS offboarding_requests_status_idx ON tenant_offboarding_requests(status);`;

    console.log('[MIGRATION] Applying Row-Level Security policies...');

    // Enable and FORCE Row Level Security on tenant tables
    const tenantTables = [
      'facilities',
      'users',
      'practitioner_profiles',
      'user_sessions',
      'password_resets',
      'patient_records',
      'patients',
      'patient_identifiers',
      'patient_consents',
      'patient_reconciliations',
      'patient_access_logs',
      'integration_configs',
      'external_references',
      'registry_sync_records',
      'job_executions',
      'file_metadata',
      'app_configurations',
      'workflow_state_transitions',
      'encounters',
      'triage_vitals',
      'patient_allergies',
      'clinical_notes',
      'clinical_note_amendments',
      'diagnoses',
      'clinical_orders',
      'medication_requests',
      'service_requests',
      'lab_specimens',
      'lab_results',
      'diagnostic_reports',
      'lab_consumables',
      'lab_consumable_deductions',
      'pharmacy_suppliers',
      'pharmacy_batches',
      'pharmacy_stock_movements',
      'medication_dispenses',
      'medication_dispense_items',
      'medication_administrations',
      'invoices',
      'invoice_line_items',
      'invoice_adjustments',
      'payments',
      'payment_allocations',
      'payment_reversals',
      'daily_reconciliations',
      'sha_preauthorizations',
      'sha_claims',
      'sha_claim_items',
      'sha_claim_submissions',
      'sha_claim_attachments',
      'sha_callback_events',
      'wards',
      'beds',
      'inpatient_admissions',
      'inpatient_bed_transfers',
      'theatres',
      'theatre_bookings',
      'maternity_deliveries',
      'newborn_profiles',
      'radiology_orders',
      'radiology_reports',
      'referrals',
      'appointments',
      'procurement_orders',
      'procurement_order_items',
      'goods_received_notes',
      'insurance_policies',
      'insurance_authorizations',
      'departments',
      'staff_rosters',
      'staff_roster_shifts',
      'tenant_subscriptions',
      'subscription_history',
      'tenant_entitlements',
      'tenant_usage_meters',
      'platform_invoices',
      'platform_invoice_items',
      'platform_payments',
      'platform_dunning_events',
      'support_cases',
      'support_case_messages',
      'support_access_grants',
      'tenant_offboarding_requests',
    ];

    for (const table of tenantTables) {
      await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await sql.unsafe(`
        DO $$
        BEGIN
          DROP POLICY IF EXISTS ${table}_isolation_policy ON ${table};
          CREATE POLICY ${table}_isolation_policy ON ${table}
            FOR ALL
            USING (
              current_setting('app.is_super_admin', true) = 'true'
              OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
              current_setting('app.is_super_admin', true) = 'true'
              OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
        END
        $$;
      `);
    }

    // Billing Service Catalogue: Allow shared global tariffs (tenant_id IS NULL) or tenant-specific tariffs
    await sql`ALTER TABLE billing_service_catalogue ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE billing_service_catalogue FORCE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS billing_service_catalogue_isolation_policy ON billing_service_catalogue;
        CREATE POLICY billing_service_catalogue_isolation_policy ON billing_service_catalogue
          FOR ALL
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );
      END
      $$;
    `;


    // Lab Test Catalog: Allow shared global tests (tenant_id IS NULL) or tenant-specific tests
    await sql`ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE lab_test_catalog FORCE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS lab_test_catalog_isolation_policy ON lab_test_catalog;
        CREATE POLICY lab_test_catalog_isolation_policy ON lab_test_catalog
          FOR ALL
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );
      END
      $$;
    `;

    // Pharmacy Products: Allow shared global KEML formulary (tenant_id IS NULL) or tenant-specific products
    await sql`ALTER TABLE pharmacy_products ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE pharmacy_products FORCE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS pharmacy_products_isolation_policy ON pharmacy_products;
        CREATE POLICY pharmacy_products_isolation_policy ON pharmacy_products
          FOR ALL
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );
      END
      $$;
    `;

    // Subscription Plans: Allow read access to all tenants, but restrict writes to Super-Admin
    await sql`ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE subscription_plans FORCE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS subscription_plans_isolation_policy ON subscription_plans;
        CREATE POLICY subscription_plans_isolation_policy ON subscription_plans
          FOR ALL
          USING (true)
          WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
      END
      $$;
    `;

    // Audit Events: Enable RLS and WORM policies (Select & Insert only, no Update or Delete)
    await sql`ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS audit_events_select_policy ON audit_events;
        CREATE POLICY audit_events_select_policy ON audit_events
          FOR SELECT
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );

        DROP POLICY IF EXISTS audit_events_insert_policy ON audit_events;
        CREATE POLICY audit_events_insert_policy ON audit_events
          FOR INSERT
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );
      END
      $$;
    `;

    // Grant schema privileges to application role afyapoa_app
    console.log('[MIGRATION] Granting permissions to afyapoa_app role...');
    await sql`GRANT CONNECT ON DATABASE afyapoa_db TO afyapoa_app;`;
    await sql`GRANT USAGE ON SCHEMA public TO afyapoa_app;`;
    await sql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO afyapoa_app;`;
    await sql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO afyapoa_app;`;
    await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO afyapoa_app;`;
    await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO afyapoa_app;`;

    console.log('[MIGRATION] All tables, indexes, and RLS policies created successfully.');
  } catch (err) {
    console.error('[MIGRATION] Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
