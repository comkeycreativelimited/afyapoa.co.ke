# COMKEY AFYA POA — Health Records & Data Retention Schedule
*(Kenyan Statutory & Regulatory Baseline)*

> **LEGAL NOTICE & COMPLIANCE DISCLAIMER:**  
> **DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS.**  
> *This document sets out the statutory and technical retention rules applicable to clinical, administrative, financial, and audit data within the COMKEY AFYA POA platform. Legal retention rules are governed by the Health Act 2017, Kenya Medical Practitioners and Dentists Council (KMPDC) regulations, the Tax Procedures Act, and the Data Protection Act 2019. Healthcare facility Data Controllers must review and adapt this schedule with their qualified medical records committee and legal counsel.*

---

## 1. Statutory & Regulatory Foundations

Health data retention in Kenya requires balancing the **storage limitation principle** under the Data Protection Act, 2019 (Section 30 & 34) against mandatory **statutory retention obligations** under healthcare, tax, and public health statutes:

1. **Kenya Health Act, 2017 (Sections 9, 10, & 12):**
   - Mandates that every healthcare provider establish and maintain a comprehensive health records management system ensuring complete confidentiality and preservation of patient histories.
2. **Kenya Medical Practitioners and Dentists Council (KMPDC) Code of Professional Conduct:**
   - Establishes professional medical standards requiring clinical records to be retained for minimum periods before disposal to protect patient care continuity and support medical-legal defense.
3. **Tax Procedures Act, 2015 (Section 23A & Section 24):**
   - Mandates that every taxpayer maintain records, tax invoices (eTIMS), and accounts for a minimum period of **six (6) years** from the end of the reporting period.
4. **Data Protection Act, 2019 (Section 34(1)(b) & Section 40(2)):**
   - While recognizing the Right to Erasure, Section 40(2) explicitly provides that erasure requests do not apply where retention is necessary for compliance with a legal obligation, public health management, or defense of legal claims.
5. **Pharmacy and Poisons Act (Cap 244) & Dangerous Drugs Act (Cap 245):**
   - Mandates strict retention for registers of controlled substances, narcotics, and prescription poisons for at least **five (5) to seven (7) years**.

---

## 2. Health Records Retention Schedule Matrix

| Record Category | Applicable Statute / Guidelines | Minimum Retention Period | Platform Storage Tier | Permissible Action at Expiry |
| :--- | :--- | :--- | :--- | :--- |
| **Adult Outpatient Records** | Health Act 2017 / KMPDC Guidelines | **10 years** from date of last attendance | Active -> Cold Archive (after 3 yrs) | Anonymization / De-identification or Archival |
| **Adult Inpatient Records** | Health Act 2017 / KMPDC Guidelines | **20 years** from date of discharge | Active -> Cold Archive (after 2 yrs) | Anonymization / De-identification or Archival |
| **Paediatric & Child Health Records** | KMPDC / Age of Majority Mandate | **10 years after 18th birthday** (Until patient reaches **28 years of age**) | Active -> Cold Archive (after 5 yrs) | Review by Medical Board before De-identification |
| **Maternity & Obstetric Records** | Public Health Act / KMPDC Rules | **25 years** from date of delivery | Active -> Cold Archive (after 5 yrs) | De-identification / Archival |
| **Deceased Patient Records** | KMPDC Guidelines | **5 years** following verified death | Cold Archive | Secure Purge / Anonymization |
| **Histopathology & Cancer / Oncology Records** | National Cancer Control Strategy | **Permanent / 30 years** | Cold Archive (Encrypted) | Permanent Archive (Historical Health Value) |
| **Clinical Lab Results & Worksheets** | Laboratory & KMLTTB Guidelines | **10 years** from result validation | Active -> Compressed Cold Tier | Purge raw worksheets; Retain final report |
| **Radiology Imaging & DICOM Studies** | Radiation Protection Board Guidelines | **10 years** (Adults) / **Until age 28** (Paediatric) | Object Storage (Tiered Glacier/Cold) | De-identification of image metadata; Purge raw blobs |
| **Pharmacy Prescriptions & Controlled Substances** | Pharmacy & Poisons Act (Cap 244) | **5 years** (Regular) / **7 years** (Controlled/DDA) | Active -> Cold Archive | Secure purge following Pharmacy Board sign-off |
| **Billing Invoices, eTIMS & Cash Receipts** | Tax Procedures Act Sec 23A & 24 | **6 years** from fiscal year-end | Active Financial Database | Purge subject to KRA audit clearance |
| **SHA eClaims & Pre-Authorizations** | Social Health Insurance Act 2023 | **7 years** from claim settlement | Active -> Cold Archive | Anonymization / De-identification |
| **Staff Rosters & Departmental Shifts** | Employment Act / OSHA | **6 years** | Cold Archive | Secure Purge |
| **Cryptographic Audit Logs (WORM)** | Kenya DPA 2019 / ISO 27001 | **7 years** (Minimum) | WORM Immutability Archive | Secure purge after regulatory clearance |
| **Patient Consents & Withdrawal Records** | Kenya DPA 2019 Section 32 | **Duration of patient record + 5 years** | Active Database | Purged concurrently with linked clinical file |

---

## 3. Storage Tiering & Lifecycle Management

To optimize cost while complying with clinical access standards, COMKEY AFYA POA implements automated data lifecycle tiering:

```
[Active Database Tier] (0 - 24 Months)
- High-performance NVMe PostgreSQL 16
- Instant clinical read/write access (<50ms)
- Fully replicated with synchronous streaming
         |
         v (Automated Migration via Worker Job)
[Warm Archive Tier] (24 Months - 5 Years)
- PostgreSQL read-only partition / Compressed Tables
- Sub-second clinical search for re-attending patients
         |
         v (Automated Archival Batch)
[Cold / Encrypted WORM Tier] (5 Years - Statutory Expiry)
- Encrypted S3-compatible Object Storage (AES-256)
- Signed FHIR R4 NDJSON bundles with SHA-256 manifests
- Retrieve latency: < 15 minutes upon authorized medical request
         |
         v (Retention Expiry Review)
[Cryptographic De-identification / Secure Erasure]
```

---

## 4. Patient Right to Erasure Protocol (DPA Section 40)

When a Data Subject submits an erasure request under Section 40 of the Data Protection Act 2019:

1. **Mandatory Legal Exception Review:**
   - The Hospital Medical Records Committee and DPO review the request against statutory retention rules.
   - If the patient has clinical encounter records within the mandatory retention window (e.g., inpatient stay within the last 20 years), **physical deletion of the clinical record is legally barred** under Section 40(2)(b) and the Health Act 2017.
2. **De-Identification & Anonymization Process:**
   - Where the statutory clinical retention applies, the system performs **irreversible de-identification**:
     - Raw and encrypted patient identifiers (`phone_encrypted`, `value_encrypted`) are scrubbed and replaced with cryptographic zeroes (`0x00`).
     - Blind index hashes (`phone_blind_index`, `value_blind_index`) are cleared to prevent exact-match lookups.
     - Demographic names are replaced with generic tokens (`DE-IDENTIFIED-DPA-SEC-40`).
     - Physical addresses, email addresses, and next-of-kin contact details are permanently purged.
   - The anonymized clinical encounters, diagnoses (ICD-11), and prescriptions are retained purely for medical audit, epidemiology, and public health statistics.
3. **Formal Written Response to Data Subject:**
   - Within **14 business days**, the hospital issues a formal notification to the data subject explaining the de-identification measures applied and the specific statutory grounds (Health Act / KMPDC) precluding total physical destruction.

---

## 5. Secure Disposal & Sanitization Standards

At the conclusion of the statutory retention period (e.g., 20 years for adult inpatient records, 6 years for eTIMS invoices), data disposal must follow rigorous sanitization procedures:

1. **Digital Record Erasure (NIST SP 800-88 Rev. 1 Guidelines):**
   - **Cryptographic Erasure:** For encrypted database columns and file storage buckets, destruction of the corresponding AES-256 key material renders all ciphertexts permanently unrecoverable.
   - **Database Row Purging:** Permanent deletion of expired rows using PostgreSQL `VACUUM FULL` and cryptographic overwriting of deleted pages.
2. **Disposal Sign-Off & Destruction Certificate:**
   - No clinical records may be purged without unanimous written sign-off from:
     1. Medical Superintendent / Hospital Director.
     2. Head of Health Records and Information Management (HRIO).
     3. Hospital Data Protection Officer.
   - A formal **Certificate of Secure Data Destruction** is generated, signed, and retained permanently in the hospital's administrative archive.

---

## 6. SaaS Tenant Offboarding Retention

When a healthcare facility offboards from the COMKEY AFYA POA cloud platform:
1. **Full Data Export:** A comprehensive export bundle formatted in **FHIR R4 NDJSON** is generated with SHA-256 integrity checksums and securely delivered to the hospital administration (`saas-offboarding.service.ts`).
2. **Statutory Grace Period Archive:** Under the SaaS contract and DPA rules, Comkey retains an encrypted, sealed backup of the tenant's data in a dormant WORM state for **10 years** (or the contractually agreed retention duration) to ensure the hospital remains compliant with KMPDC standards.
3. **Tenant Seal:** Tenant status is switched to `OFFBOARDED`; all interactive logins, API keys, and background workers are permanently deactivated.
