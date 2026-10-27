import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { config } from '@afyapoa/config';

/**
 * SYNTHETIC SEED DATA — 100% FICTIONAL DEMO HEALTHCARE ORGANIZATIONS
 * CONTAINS ZERO REAL PATIENT DATA.
 */
async function runSeed() {
  console.log('[SEED] Connecting to database for synthetic seeding...');
  const sql = postgres(config.DATABASE_URL, { max: 1 });

  try {
    console.log('[SEED] Setting super-admin context for seeding...');
    await sql`SET app.is_super_admin = 'true';`;

    console.log('[SEED] Cleaning existing seed data...');
    await sql`DELETE FROM workflow_state_transitions;`;
    await sql`DELETE FROM external_references;`;
    await sql`DELETE FROM integration_configs;`;
    await sql`DELETE FROM job_executions;`;
    await sql`DELETE FROM file_metadata;`;
    await sql`DELETE FROM app_configurations;`;
    await sql`DELETE FROM patient_access_logs;`;
    await sql`DELETE FROM patient_reconciliations;`;
    await sql`DELETE FROM patient_consents;`;
    await sql`DELETE FROM patient_identifiers;`;
    await sql`DELETE FROM audit_events;`;
    await sql`DELETE FROM patient_records;`;
    await sql`DELETE FROM patients;`;
    await sql`DELETE FROM practitioner_profiles;`;
    await sql`DELETE FROM password_resets;`;
    await sql`DELETE FROM user_sessions;`;
    await sql`DELETE FROM users;`;
    await sql`DELETE FROM facilities;`;
    await sql`DELETE FROM tenants;`;

    console.log('[SEED] Inserting synthetic healthcare organizations (tenants)...');

    // 1. Tenant A: Nairobi Metropolitan Healthcare Group
    const [tenantA] = await sql`
      INSERT INTO tenants (code, name, tier, status)
      VALUES (
        'tenant-nmhg',
        'Nairobi Metropolitan Healthcare Group',
        'ENTERPRISE',
        'ACTIVE'
      )
      RETURNING id, code, name;
    `;

    // 2. Tenant B: Afya Poa Community Health Network
    const [tenantB] = await sql`
      INSERT INTO tenants (code, name, tier, status)
      VALUES (
        'tenant-kibera-net',
        'Afya Poa Community Health Network',
        'STANDARD',
        'ACTIVE'
      )
      RETURNING id, code, name;
    `;

    if (!tenantA || !tenantB) {
      throw new Error('Failed to seed synthetic tenants');
    }

    console.log(`[SEED] Seeded Tenant A: ${tenantA.name} (${tenantA.id})`);
    console.log(`[SEED] Seeded Tenant B: ${tenantB.name} (${tenantB.id})`);

    // 3. Facilities under Tenant A (Nairobi Metropolitan Healthcare Group)
    const [facilityA1] = await sql`
      INSERT INTO facilities (
        tenant_id, kmfl_code, name, level, county, sub_county, physical_address, contact_phone, contact_email, sha_contract_code, dha_hie_endpoint, kra_pin
      )
      VALUES (
        ${tenantA.id}, 'FID-01-000101-1', 'Nairobi Metropolitan Referral Hospital', 'LEVEL_5', 'Nairobi', 'Starehe',
        'Hospital Road, Upper Hill, Nairobi', '+254700000001', 'info@nmrh.demo.afyapoa.co.ke', 'SHA-CTR-00101', 'https://dha-mock.afyapoa.co.ke/hie/nmrh', 'P051000001A'
      )
      RETURNING id, kmfl_code, name;
    `;

    const [facilityA2] = await sql`
      INSERT INTO facilities (
        tenant_id, kmfl_code, name, level, county, sub_county, physical_address, contact_phone, contact_email, sha_contract_code, dha_hie_endpoint, kra_pin
      )
      VALUES (
        ${tenantA.id}, 'FID-01-000102-2', 'NMHG Westlands Urgent Care Centre', 'LEVEL_4', 'Nairobi', 'Westlands',
        'Waiyaki Way, Westlands, Nairobi', '+254700000002', 'westlands@nmrh.demo.afyapoa.co.ke', 'SHA-CTR-00102', 'https://dha-mock.afyapoa.co.ke/hie/westlands', 'P051000001A'
      )
      RETURNING id, kmfl_code, name;
    `;

    // 4. Facility under Tenant B (Afya Poa Community Health Network)
    const [facilityB1] = await sql`
      INSERT INTO facilities (
        tenant_id, kmfl_code, name, level, county, sub_county, physical_address, contact_phone, contact_email, sha_contract_code, dha_hie_endpoint, kra_pin
      )
      VALUES (
        ${tenantB.id}, 'FID-01-000202-3', 'Afya Poa Health Centre Kibera', 'LEVEL_3', 'Nairobi', 'Kibra',
        'Olympic Estate, Kibera, Nairobi', '+254700000003', 'info@kibera.demo.afyapoa.co.ke', 'SHA-CTR-00202', 'https://dha-mock.afyapoa.co.ke/hie/kibera', 'P051000002B'
      )
      RETURNING id, kmfl_code, name;
    `;

    if (!facilityA1 || !facilityA2 || !facilityB1) {
      throw new Error('Failed to seed synthetic facilities');
    }

    console.log(`[SEED] Seeded facilities: ${facilityA1.name}, ${facilityA2.name}, ${facilityB1.name}`);

    // Passwords for test accounts: Password123!
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const testMfaSecret = 'JBSWY3DPEHPK3PXP';

    // 5. Users for Tenant A
    await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantA.id}, ${facilityA1.id}, 'superadmin', 'superadmin@afyapoa.co.ke', 'System Super Administrator', 'SUPER_ADMIN',
        ${passwordHash}, true, ${testMfaSecret}, true, 'ACTIVE'
      );
    `;

    await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantA.id}, ${facilityA1.id}, 'admin.nmhg', 'admin@nmhg.demo.afyapoa.co.ke', 'Dr. Amina Mohamed (Hospital Admin)', 'FACILITY_ADMIN',
        ${passwordHash}, true, ${testMfaSecret}, false, 'ACTIVE'
      );
    `;

    const [drOtieno] = await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantA.id}, ${facilityA1.id}, 'dr.otieno', 'dr.otieno@nmhg.demo.afyapoa.co.ke', 'Dr. David Otieno (Physician)', 'CLINICIAN',
        ${passwordHash}, false, null, false, 'ACTIVE'
      )
      RETURNING id, username;
    `;

    await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantA.id}, ${facilityA1.id}, 'nurse.faith', 'faith@nmhg.demo.afyapoa.co.ke', 'Nurse Faith Wanjiku (Triage)', 'TRIAGE_NURSE',
        ${passwordHash}, false, null, false, 'ACTIVE'
      );
    `;

    // 6. Users for Tenant B
    await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantB.id}, ${facilityB1.id}, 'admin.kibera', 'admin@kibera.demo.afyapoa.co.ke', 'Peter Njoroge (Clinic Admin)', 'FACILITY_ADMIN',
        ${passwordHash}, true, ${testMfaSecret}, false, 'ACTIVE'
      );
    `;

    const [drMary] = await sql`
      INSERT INTO users (
        tenant_id, primary_facility_id, username, email, full_name, role, password_hash, mfa_enabled, mfa_secret, is_super_admin, status
      )
      VALUES (
        ${tenantB.id}, ${facilityB1.id}, 'dr.mary', 'dr.mary@kibera.demo.afyapoa.co.ke', 'Dr. Mary Mutua (Clinical Officer)', 'CLINICIAN',
        ${passwordHash}, false, null, false, 'ACTIVE'
      )
      RETURNING id, username;
    `;

    if (!drOtieno || !drMary) {
      throw new Error('Failed to seed clinician users');
    }

    console.log(`[SEED] Seeded users for Tenant A and Tenant B.`);

    // 7. Practitioner Profiles (DHA Health Worker Registry / KMPDC)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    await sql`
      INSERT INTO practitioner_profiles (
        tenant_id, user_id, puid, cadre, regulatory_board, license_number, license_status, license_expires_at
      )
      VALUES
        (${tenantA.id}, ${drOtieno.id}, 'PUID-KMPDC-A00101', 'Medical Specialist', 'KMPDC', 'KMPDC-LIC-88912', 'ACTIVE', ${futureDate}),
        (${tenantB.id}, ${drMary.id}, 'PUID-COC-B00202', 'Clinical Officer Council', 'COC', 'COC-LIC-44120', 'ACTIVE', ${futureDate});
    `;

    // 8. Synthetic Patient Records for Tenant Isolation Regression Testing
    await sql`
      INSERT INTO patient_records (
        tenant_id, facility_id, record_number, patient_alias, notes
      )
      VALUES
        (${tenantA.id}, ${facilityA1.id}, 'REC-NMHG-001', 'SYNTHETIC-PATIENT-ALPHA', 'Confidential clinical history for Tenant A'),
        (${tenantA.id}, ${facilityA1.id}, 'REC-NMHG-002', 'SYNTHETIC-PATIENT-BETA', 'Discharge summary notes for Tenant A'),
        (${tenantB.id}, ${facilityB1.id}, 'REC-KIBERA-001', 'SYNTHETIC-PATIENT-GAMMA', 'Confidential clinical history for Tenant B');
    `;

    console.log('[SEED] Seeded synthetic patient records for cross-tenant regression verification.');
    console.log('[SEED] Synthetic demonstration seed completed successfully.');
  } catch (err) {
    console.error('[SEED] Seeding error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runSeed();
