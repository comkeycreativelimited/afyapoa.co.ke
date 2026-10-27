# COMKEY AFYA POA — Data Protection Impact Assessment (DPIA) Template
*(Pursuant to Section 31 of the Kenya Data Protection Act, 2019)*

> **LEGAL NOTICE & COMPLIANCE DISCLAIMER:**  
> **DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS.**  
> *This document provides a statutory DPIA template aligned with Section 31 of the Kenya Data Protection Act 2019 and the ODPC Guidance Notes on Data Protection Impact Assessment. Healthcare facilities deploying COMKEY AFYA POA must complete, tailor, and formally sign off this assessment in consultation with their designated Data Protection Officer (DPO) before processing live clinical patient records.*

---

## 1. Project & Processing Overview

| Attribute | Details |
| :--- | :--- |
| **Project / System Name** | COMKEY AFYA POA Multi-Tenant Cloud HMIS |
| **Data Controller (Healthcare Facility)** | [INSERT HOSPITAL NAME / COUNTY HEALTH DEPARTMENT] |
| **ODPC Controller Registration No.** | [INSERT ODPC CERTIFICATE NUMBER] |
| **Data Processor (Platform Provider)** | Comkey Creative Limited |
| **ODPC Processor Registration No.** | [INSERT COMKEY ODPC REGISTRATION NUMBER] |
| **Assessment Lead / Author** | [NAME, TITLE — e.g., Hospital IT Director / Compliance Officer] |
| **Designated Data Protection Officer** | [NAME, EMAIL, TELEPHONE OF HOSPITAL DPO] |
| **Assessment Date & Version** | October 2026 — Version 1.0 |

---

## 2. DPIA Threshold Assessment (Why is a DPIA Mandatory?)

Under **Section 31(1)** of the Data Protection Act 2019 and the ODPC DPIA Guidance Notes, a DPIA is legally mandatory if processing is likely to result in a **high risk** to the rights and freedoms of data subjects. 

This platform meets the statutory threshold based on the following criteria:

- [x] **Large-Scale Processing of Sensitive Personal Data:** Processing of patient medical histories, clinical diagnoses (ICD-11), surgical notes, and psychiatric records across hospital networks.
- [x] **Vulnerable Data Subjects:** Processing health records of children, newborns, pregnant mothers, and unconscious trauma victims.
- [x] **Integration with National Digital Platforms:** Bidirectional exchange of FHIR R4 clinical payloads with the Digital Health Agency (DHA) HIE and automated claims adjudication with the Social Health Authority (SHA).
- [x] **Biometric / Unique Government Identifiers:** Collection and matching of Kenyan National IDs, Civil Registration Numbers (CRID), and Universal Personal Identifiers (UPI).
- [x] **Automated Duplicate Detection & Algorithmic Record Matching:** Machine scoring of demographic similarities for patient identity deduplication.

---

## 3. Systematic Description of the Processing Operations

### 3.1 Nature and Scope of Personal Data
1. **General Personal Data:**
   - Full names, date of birth, biological sex, phone number, email, physical address, next-of-kin emergency contact details.
2. **Sensitive Personal Data (Health Data under DPA Section 2):**
   - Triage vital signs, clinical consultation notes, working and confirmed diagnoses, surgical records, maternity and delivery partographs, laboratory investigation results, radiology reports, pharmacy prescriptions, and drug dispensing records.
3. **National Identifiers:**
   - Kenyan National ID number, SHA/SHIF Beneficiary Number, DHA CRID, UPI, KRA PIN (for billing/eTIMS).

### 3.2 Data Flow Architecture & Interactions
- **Intake:** Reception / Triage records demographics via Web SPA or mobile PWA. Data encrypted in transit via TLS 1.3.
- **Processing:** NestJS API cluster processes requests within strictly enforced tenant contexts; business logic performs role-based authorization.
- **Persistence:** High-consequence fields (National ID, phone numbers) encrypted at rest using AES-256-GCM. Deterministic blind indexes (HMAC-SHA256) used for search. PostgreSQL enforces `FORCE ROW LEVEL SECURITY`.
- **National Dispatch:** Asynchronous BullMQ background workers dispatch FHIR R4 bundles to DHA and eClaims to SHA over encrypted mTLS channels.

---

## 4. Assessment of Necessity and Proportionality

| Principle (Section 3) | Platform Compliance Implementation | Proportionality Justification |
| :--- | :--- | :--- |
| **Lawful Basis (Sec 30 & 32)** | - Explicit patient consent (`patient_consents`).<br>- Medical treatment by bound health professionals (Sec 32(1)(b)).<br>- Vital interests during emergency trauma intake (Sec 30(1)(c)). | Necessary to provide safe medical diagnosis and hospital care. |
| **Data Minimization (Sec 3(b))** | - Emergency trauma intake collects minimal survival vitals.<br>- UI displays masked identifiers (`*****678`).<br>- Outbound logs redact clinical PHI payloads (`sanitizeForLogging`). | Only fields clinically necessary for treatment and billing are collected. |
| **Purpose Limitation (Sec 3(c))** | - Patient access logs track access purpose (`CLINICAL_TREATMENT`, `BILLING_VERIFICATION`).<br>- Non-clinical users (cashiers) cannot view detailed doctor consultation notes. | Data collected for healthcare is strictly segregated from marketing or third-party reuse. |
| **Storage Limitation (Sec 3(f))** | - Automated retention schedule complying with Health Act (10-20 yrs) and Tax Procedures Act (6 yrs).<br>- Automated de-identification for erasure requests. | Balances patient right to erasure against mandatory clinical record-keeping statutes. |

---

## 5. Risk Assessment & Identification of Harms to Data Subjects

| Risk ID | Potential Risk Event | Sources / Threat Scenario | Inherent Severity | Inherent Likelihood | Overall Inherent Risk |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **R-01** | **Cross-Tenant Data Spillage** | Software defect or database connection pooling issue allows staff in Hospital A to view patients in Hospital B. | Critical | Low | **High** |
| **R-02** | **Unauthorized Disclosure of Sensitive Health Data** | Insider snooping into VIP / celebrity medical files, HIV status, or maternity records. | High | Medium | **High** |
| **R-03** | **Patient Misidentification / Erroneous Record Merge** | Automated duplicate matching incorrectly merges two distinct patients, causing clinical medication error. | Critical | Low | **High** |
| **R-04** | **Denial of Care Due to System Downtime or Consent Block** | Unconscious casualty patient cannot be registered because system demands explicit OTP consent. | Critical | Medium | **Critical** |
| **R-05** | **Identity Theft via Mass PII Exfiltration** | Attacker dumps database and steals millions of patient National IDs and phone numbers. | High | Low | **Medium** |

---

## 6. Measures Envisaged to Address and Mitigate Risks

| Risk ID | Technical & Organizational Mitigating Measures | Residual Severity | Residual Likelihood | Overall Residual Risk |
| :--- | :--- | :---: | :---: | :---: |
| **R-01** | - PostgreSQL `FORCE ROW LEVEL SECURITY` on all tenant tables.<br>- Database user `afyapoa_app` has `NOSUPERUSER NOBYPASSRLS`.<br>- Non-superadmin cannot supply `x-tenant-id` header.<br>- Automated tests 2.1-2.4 verify cross-tenant blocks. | Low | Low | **LOW** |
| **R-02** | - Fine-grained RBAC across 9 clinical roles.<br>- Mandatory `patient_access_logs` tracking every view event.<br>- Immutable WORM audit trail with SHA-256 hash chaining. | Medium | Low | **LOW** |
| **R-03** | - System prohibits automatic merges. Probabilistic match >=70% flags duplicate for manual review.<br>- Non-destructive merge preserves source record with `status: MERGED`. | Low | Low | **LOW** |
| **R-04** | - Emergency Trauma Intake ("Break-Glass") allows immediate intake without consent or identification.<br>- Offline service worker caching permits triage documentation during internet cuts. | Low | Low | **LOW** |
| **R-05** | - AES-256-GCM encryption on all stored National IDs and phone numbers.<br>- Deterministic HMAC-SHA256 blind indexing prevents cleartext leakage in dumps.<br>- Pino structured logger redacts credentials and tokens. | Low | Low | **LOW** |

---

## 7. Data Protection Officer (DPO) Advice & Sign-Off

### 7.1 DPO Consultation Summary
*The Data Protection Officer has reviewed the proposed processing operations, technical architecture, and mitigation controls:*
- [x] The processing is necessary for the delivery of healthcare services under the Health Act 2017.
- [x] Technical controls (RLS, AES-256-GCM encryption, WORM audit trails) meet the standards of OWASP ASVS 4.0 Level 2.
- [x] The measures reduce all identified high risks to acceptable residual levels.
- [x] Prior consultation with the ODPC under Section 31(2) is **not required** because residual risks have been successfully mitigated by the implemented technical controls.

### 7.2 Formal Approvals

**Prepared By:**  
Name: ____________________________________  
Title: Lead Health Information Systems Architect  
Date: ____________________________________  

**Reviewed & Recommended By:**  
Name: ____________________________________  
Title: Data Protection Officer (DPO)  
Registration No: _________________________  
Date: ____________________________________  

**Approved on behalf of the Data Controller:**  
Name: ____________________________________  
Title: Medical Superintendent / Chief Executive Officer  
Date: ____________________________________  
