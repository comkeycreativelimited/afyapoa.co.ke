# COMKEY AFYA POA — Data Processing Agreement (DPA) Template
*(Pursuant to Section 42 of the Kenya Data Protection Act, 2019)*

> **LEGAL NOTICE & COMPLIANCE DISCLAIMER:**  
> **DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS.**  
> *This Data Processing Agreement template is prepared in alignment with Section 42 of the Kenya Data Protection Act, 2019 and the Data Protection (General) Regulations, 2021. It governs the relationship between the Healthcare Facility (Data Controller) and Comkey Creative Limited (Data Processor). Parties must submit this agreement to their qualified legal counsel before signing.*

---

**THIS DATA PROCESSING AGREEMENT** ("Agreement") is made this _____ day of _______________, 20____,

**BETWEEN:**

1. **[NAME OF HEALTHCARE FACILITY]**, a medical institution established under the laws of Kenya, having its principal place of business at [Hospital Physical Address, County], Kenya (hereinafter referred to as the **"Data Controller"**); and
2. **COMKEY CREATIVE LIMITED**, a limited liability company incorporated under the Companies Act of Kenya, having its registered office in Nairobi, Kenya (hereinafter referred to as the **"Data Processor"** or **"Comkey"**).

The Data Controller and Data Processor are collectively referred to as the **"Parties"** and individually as a **"Party"**.

---

## RECITALS

**WHEREAS:**
A. The Data Controller provides healthcare services and wishes to engage the Data Processor to provide the **COMKEY AFYA POA** multi-tenant cloud Health Management Information System (HMIS) software-as-a-service;
B. In delivering the Service, the Data Processor will process Personal Data, including Sensitive Personal Data (Health Data), on behalf of the Data Controller;
C. Section 42 of the Kenya Data Protection Act, 2019 requires that processing of personal data by a data processor on behalf of a data controller shall be governed by a written contract setting out the processing details, security measures, and statutory obligations;

**NOW IT IS HEREBY AGREED as follows:**

---

### Article 1: Definitions and Interpretation

1.1. In this Agreement, unless the context otherwise requires:
- **"Applicable Law"** means the Data Protection Act, 2019 (Act No. 24 of 2019), the Data Protection (General) Regulations, 2021, the Health Act, 2017, the Digital Health Act, 2023, and all statutory regulations issued by the ODPC.
- **"Data Controller"**, **"Data Processor"**, **"Data Subject"**, **"Personal Data"**, and **"Processing"** have the meanings assigned to them under Section 2 of the DPA 2019.
- **"Health Data"** means personal data related to the physical or mental health of a data subject, including the provision of health care services, which reveal information about the health status of the data subject.
- **"Personal Data Breach"** means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data transmitted, stored, or otherwise processed.
- **"ODPC"** means the Office of the Data Protection Commissioner of Kenya.
- **"Technical and Organizational Measures (TOMs)"** means security measures designed to protect personal data against accidental, unauthorized, or unlawful processing, disclosure, or loss, as detailed in **Schedule B**.

---

### Article 2: Scope, Subject Matter, and Purpose of Processing

2.1. **Subject Matter:** The processing of patient demographic, clinical, billing, and operational records via the COMKEY AFYA POA cloud application.  
2.2. **Duration:** The duration of the Main SaaS Master Services Agreement, plus any mandatory statutory retention period under the Health Act 2017.  
2.3. **Nature and Purpose:** To enable patient intake, clinical documentation, laboratory diagnostics, pharmacy dispensing, SHA eClaims processing, KRA eTIMS invoice signing, and health facility administration.  
2.4. **Categories of Data & Data Subjects:** Fully specified in **Schedule A** attached hereto.

---

### Article 3: Obligations and Rights of the Data Controller

3.1. The Data Controller warrants that all Personal Data provided to the Data Processor has been lawfully collected under Sections 30 and 32 of the DPA 2019.  
3.2. The Data Controller shall have the sole responsibility for determining the lawful basis for processing, capturing patient consent (where required), and responding to data subject rights requests.  
3.3. The Data Controller has the right to monitor compliance by the Data Processor through reasonable audits as provided in Article 7.

---

### Article 4: Obligations of the Data Processor

4.1. **Instructions of the Controller:** The Data Processor shall process Personal Data **only on documented instructions** from the Data Controller, including with respect to cross-border data transfers, unless required to do so by applicable Kenyan law.  
4.2. **Confidentiality:** The Data Processor shall ensure that all personnel authorized to process Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of secrecy.  
4.3. **Security of Processing:** The Data Processor shall implement and maintain the Technical and Organizational Measures set out in **Schedule B**, maintaining compliance with the **OWASP ASVS 4.0 Level 2** baseline, including:
   - Mandatory PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) ensuring absolute cross-tenant isolation.
   - AES-256-GCM field encryption for patient National IDs and mobile telephone numbers.
   - Deterministic HMAC-SHA256 blind indexing for searchable encryption without cleartext leakage.
   - Append-only, cryptographically chained WORM audit logs with serialized advisory locking.
4.4. **Sub-Processors:**
   - The Data Controller grants general written authorization to the Data Processor to engage sub-processors (e.g., local Kenyan cloud hosting infrastructure providers).
   - The Data Processor shall notify the Data Controller at least thirty (30) days in advance of any intended changes concerning the addition or replacement of sub-processors.
   - The Data Processor shall impose the same data protection obligations on the sub-processor as set out in this Agreement.

---

### Article 5: Assistance with Data Subject Rights & Regulatory Inquiries

5.1. Taking into account the nature of the processing, the Data Processor shall assist the Data Controller by appropriate technical measures (including automated export tools and de-identification functions) for the fulfillment of the Data Controller's obligation to respond to requests from Data Subjects exercising their statutory rights under Part IV of the DPA 2019:
   - Right of Access (Section 38);
   - Right to Object to Processing (Section 39);
   - Right to Rectification (Section 40(1));
   - Right to Erasure / De-identification (Section 40(2)).

---

### Article 6: Personal Data Breach Notification

6.1. Under Section 43(2) of the DPA 2019, the Data Processor shall notify the Data Controller **without undue delay, and in any event within forty-eight (48) hours**, upon becoming aware of a confirmed Personal Data Breach affecting the Data Controller's data.  
6.2. The notification shall contain at least:
   - A description of the nature of the incident, including categories and approximate numbers of data subjects and records affected;
   - The identity and contact details of the Data Processor's DPO;
   - The likely consequences of the incident;
   - The mitigation and remedial measures taken or proposed.  
6.3. The Data Processor shall provide all reasonable assistance to enable the Data Controller to fulfill its statutory obligation to notify the ODPC within **72 hours** under Section 43(1).

---

### Article 7: Audits and Compliance Inspections

7.1. The Data Processor shall make available to the Data Controller all information necessary to demonstrate compliance with the obligations laid down in this Agreement.  
7.2. The Data Processor shall allow for and contribute to audits, including inspections, conducted by the Data Controller or an independent certified auditor mandated by the Data Controller or the ODPC, upon at least fourteen (14) business days' prior written notice.

---

### Article 8: Cross-Border Transfers & Data Localization

8.1. Under Section 50 of the DPA 2019 and the Data Protection (General) Regulations 2021, the Data Processor covenants that all primary databases, active servers, and primary backups storing patient Health Data shall be **located within the territory of the Republic of Kenya**.  
8.2. No cross-border transfer of Health Data shall take place without the prior written consent of the Data Controller and verification of statutory compliance under Section 48 and 49 of the DPA 2019.

---

### Article 9: Termination, Return, and Deletion of Data

9.1. Upon termination of the SaaS agreement, the Data Processor shall, at the choice of the Data Controller:
   - Generate and securely transfer a complete **FHIR R4 NDJSON** export bundle of all patient records, encounters, and audit trails to the Data Controller; and
   - Securely delete or seal existing copies in accordance with the statutory clinical retention requirements set forth in the Health Act 2017 and KMPDC guidelines (minimum 10 years).

---

### Article 10: Governing Law and Dispute Resolution

10.1. This Agreement shall be governed by, and construed in accordance with, the **Laws of Kenya**.  
10.2. Any dispute arising out of or in connection with this Agreement shall first be referred to amicable resolution between the designated DPOs within fourteen (14) days. Failing amicable resolution, the dispute shall be referred to arbitration under the Arbitration Act, 1995 of Kenya or the statutory dispute resolution mechanisms provided under the Data Protection Act 2019.

---

## SCHEDULE A: PROCESSING SPECIFICATIONS

| Dimension | Details |
| :--- | :--- |
| **Categories of Data Subjects** | Patients, Outpatients, Inpatients, Minors, Hospital Medical Staff, Administrative Personnel. |
| **Categories of Personal Data** | Full names, date of birth, gender, telephone numbers, residential location, emergency contacts, national ID numbers, NHIF/SHA numbers. |
| **Special Categories (Sensitive Health Data)** | Diagnostic codes (ICD-11), clinical progress notes, lab results, radiological studies, prescription orders, surgical notes, vital signs. |
| **Financial Data** | M-Pesa transaction reference codes, insurance pre-authorization codes, eTIMS fiscal invoices, fee exemptions. |
| **Processing Operations** | Digital clinical intake, automated scheduling, electronic claims submission, clinical decision support, fiscal receipting. |

---

## SCHEDULE B: TECHNICAL AND ORGANIZATIONAL MEASURES (TOMs)

1. **Access Control & Multi-Tenancy:**
   - Multi-tenant data segregation enforced at the database layer via PostgreSQL `FORCE ROW LEVEL SECURITY`.
   - Dedicated application role `afyapoa_app` operating with `NOSUPERUSER NOBYPASSRLS`.
   - Verification that non-superadmin clients cannot override or spoof the `x-tenant-id` header.
2. **Cryptographic Protection:**
   - AES-256-GCM authenticated encryption for sensitive PII (National ID, Phone).
   - Deterministic HMAC-SHA256 blind indexing for exact-match database queries.
   - TLS 1.3 enforced for all transport connections with HSTS (1-year preload).
3. **Audit Trails & Tamper Resistance:**
   - Append-only WORM audit log preventing `UPDATE` and `DELETE` operations.
   - Cryptographic SHA-256 event hash chaining serialized per tenant via PostgreSQL advisory transaction locks.
4. **Availability & Business Continuity:**
   - Automated point-in-time recovery (PITR) WAL archiving with 15-minute RPO.
   - Circuit breaker resilience patterns isolating external national gateway failures (DHA/SHA/KRA).
   - Offline service worker caching ensuring continuity of casualty triage during internet disruptions.

---

**IN WITNESS WHEREOF**, the Parties have caused this Data Processing Agreement to be executed by their duly authorized representatives on the date first written above.

**FOR THE DATA CONTROLLER:**  
Name: ____________________________________  
Signature: _______________________________  
Title: Chief Executive Officer / Medical Superintendent  
Facility Name: ___________________________  

**FOR THE DATA PROCESSOR (COMKEY CREATIVE LIMITED):**  
Name: ____________________________________  
Signature: _______________________________  
Title: Director / Chief Technology Officer  
Company: Comkey Creative Limited  
