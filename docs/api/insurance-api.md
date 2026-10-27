# COMKEY AFYA POA — Private Insurance Adapters API Documentation

## 1. Overview & Underwriter Specifications

The **Private Insurance Adapters Subsystem** provides pluggable integration for commercial healthcare underwriters operating in Kenya:
1. **Supported Commercial Insurers:**
   - **Jubilee Insurance Kenya**
   - **AAR Insurance Kenya**
   - **APA Insurance**
   - **Britam Insurance**
   - **Old Mutual / UAP Old Mutual**
2. **Insurance Regulatory Authority (IRA) Guidelines:** Adheres to statutory health insurance guidelines, member identification schemes, and preauthorization requirements.
3. **Real-Time Eligibility Checking:** Evaluates active cover status, member valid dates, annual inpatient/outpatient remaining balances, and patient fixed out-of-pocket copay amounts.
4. **Preauthorization Workflow:** Enables clinicians to submit estimated procedure charges and clinical rationales, tracking insurer approvals, approved amounts, and preauth authorization numbers.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `INSURANCE_READ`: View member policies, benefits, and authorization letters.
- `INSURANCE_POLICY_WRITE`: Register or modify private insurance policies (Front Desk, Billing).
- `INSURANCE_PREAUTH_REQUEST`: Submit clinical preauthorization requests (Clinicians, Claims Officers).
- `INSURANCE_PREAUTH_APPROVE`: Record insurer approvals and preauth codes.

---

## 3. Endpoints Specification

### 3.1 Policy Registration & Eligibility Checks

#### `POST /insurance/policies`
Registers a private commercial insurance policy for a patient.
- **Request Body:**
  ```json
  {
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "payer": "JUBILEE",
    "policyNumber": "JUB-MED-884910",
    "memberNumber": "MEM-091823-01",
    "inpatientLimit": "2000000.00",
    "outpatientLimit": "150000.00",
    "copayAmount": "500.00"
  }
  ```
- **Response `201 Created`:** Created policy record with status `ACTIVE`.

#### `GET /insurance/policies/:id/eligibility`
Performs real-time eligibility check against the underwriter adapter.
- **Query Parameters:** `estimatedAmount` (optional)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "eligible": true,
      "payer": "JUBILEE",
      "policyNumber": "JUB-MED-884910",
      "memberNumber": "MEM-091823-01",
      "copayRequired": 500,
      "inpatientRemainingLimit": 2000000,
      "outpatientRemainingLimit": 150000,
      "preauthRequired": false,
      "message": "Member active. Benefits available."
    }
  }
  ```

---

### 3.2 Preauthorizations

#### `POST /insurance/preauthorizations`
Requests preauthorization from the private insurer for a planned procedure or high-cost investigation.
- **Request Body:**
  ```json
  {
    "policyId": "35297364-bfa3-41cd-8e24-70d42fd5fa64",
    "procedureCode": "SURG-APP-01",
    "requestedAmount": "120000.00",
    "clinicalNotes": "Acute complicated appendectomy with localized peritonitis. Inpatient stay required."
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "9fb7b620-4fd3-4a72-a623-f01278d6be81",
      "authorizationNumber": "PA-JUB-202610-001",
      "requestedAmount": "120000.00",
      "approvedAmount": "0.00",
      "status": "PENDING",
      "createdAt": "2026-10-22T15:03:40.384Z"
    }
  }
  ```

#### `POST /insurance/preauthorizations/:id/approve`
Records insurer adjudication and authorized amount.
- **Request Body:**
  ```json
  {
    "approvedAmount": "120000.00",
    "approvalNotes": "Approved in full under Jubilee Comprehensive Inpatient Scheme."
  }
  ```
- **Response `201 Created`:** Updates status to `APPROVED` and records authorized ceiling.
