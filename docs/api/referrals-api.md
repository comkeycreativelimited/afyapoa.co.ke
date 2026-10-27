# COMKEY AFYA POA — Referrals & Counter-Referrals API Documentation

## 1. Overview & National Referral Strategy

The **Referrals and Counter-Referrals Module** coordinates inter-facility care transitions grounded in:
1. **Kenya National Referral Strategy (2014–2020 & 2023–2030)** and the Kenya Master Health Facility List (KMFL) tier hierarchy.
2. **Standardized KMFL Facility Dispatch:** All outbound and inbound referrals validate destination and source facilities using standardized Ministry of Health KMFL codes (e.g. `FID-47-115307-8`).
3. **Emergency Priority Triage:** Enforces explicit priority tiers: `ROUTINE`, `URGENT`, and `EMERGENCY`, with ambulance and transport logistics tracking.
4. **Closed-Loop Counter-Referrals:** In accordance with clinical care continuity standards, receiving specialist centers record counter-referral clinical findings, discharge notes, and ongoing management instructions transmitted back to the referring primary care provider.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `REFERRALS_READ`: View outbound and inbound referral registries.
- `REFERRALS_CREATE`: Authorize and dispatch patient referrals to tertiary or secondary centers.
- `REFERRALS_UPDATE`: Update dispatch state (`DISPATCHED`, `ACCEPTED`, `COMPLETED`, `CANCELLED`).
- `REFERRALS_COUNTER`: Document counter-referral clinical feedback and discharge care instructions.

---

## 3. Endpoints Specification

### 3.1 Referral Dispatch & Lifecycle

#### `POST /referrals`
Creates and dispatches an inter-facility referral.
- **Permission:** `REFERRALS_CREATE`
- **Request Body:**
  ```json
  {
    "sourceFacilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "destinationKmflCode": "13023",
    "destinationFacilityName": "Kenyatta National Hospital Referral Facility",
    "reason": "Specialized pediatric cardiology evaluation for suspected complex congenital heart defect",
    "transportType": "AMBULANCE",
    "priority": "URGENT",
    "referringPractitionerId": "d8226227-54f9-4525-b4a7-977e232e0a92"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "c14831c8-33c7-41ad-85e0-7cb9d1ba2a28",
      "referralNumber": "REF-202610-0001",
      "direction": "OUTBOUND",
      "status": "DISPATCHED",
      "createdAt": "2026-10-22T15:03:39.144Z"
    }
  }
  ```

#### `GET /referrals`
Lists referrals filtered by direction, priority, or facility.
- **Permission:** `REFERRALS_READ`
- **Query Parameters:** `direction` (`OUTBOUND`, `INBOUND`), `status`, `patientId`

#### `PATCH /referrals/:id/status`
Updates referral transit status.
- **Request Body:**
  ```json
  {
    "status": "ACCEPTED"
  }
  ```

---

### 3.2 Counter-Referrals (Closed-Loop Continuity of Care)

#### `POST /referrals/:id/counter-referral`
Records specialist findings, procedures performed, and long-term management advice sent back to the referring facility upon patient stabilization or discharge.
- **Permission:** `REFERRALS_COUNTER`
- **Request Body:**
  ```json
  {
    "counterReferralSummary": "Echocardiogram completed: Small muscular VSD with no hemodynamically significant shunt. Patient medically stabilized on oral spironolactone; safe for follow-up and monitoring at primary health centre in 3 months."
  }
  ```
- **Response `201 Created`:** Updates referral status to `COMPLETED` and emits a `COUNTER_REFERRAL_COMPLETED` audit event.
