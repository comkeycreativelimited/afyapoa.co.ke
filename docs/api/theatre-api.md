# COMKEY AFYA POA — Operating Theatre & Procedure Scheduling API Documentation

## 1. Overview & Surgical Standards

The **Operating Theatre and Procedure Scheduling Module** coordinates surgical suites and procedures across Kenyan hospitals in accordance with:
1. **WHO Guidelines for Safe Surgery (2009)** and the standard 3-stage Surgical Safety Checklist (Sign In, Time Out, Sign Out).
2. **KMPDC Surgical Facility Norms and Standards** for Level 4–6 hospitals.
3. **Slot Overlap Conflict Prevention:** Surgical bookings on the same theatre suite are subjected to transactional time-window checks. Any attempted overlapping booking on the same room returns `409 Conflict`.
4. **Lifecycle State Management:** `SCHEDULED` -> `PREOP` -> `IN_PROCEDURE` -> `POSTOP` -> `COMPLETED`, or `CANCELLED`.
5. **Electronic Attestation:** Records practitioner identities, timestamp digests, and confirmation checklists prior to anesthesia induction and skin incision.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Roles / Permissions:
- `SURGEON`, `DOCTOR`, `THEATRE_NURSE`, `HOSPITAL_ADMIN`
- Permissions: `THEATRE_READ`, `THEATRE_BOOK`, `THEATRE_CHECKLIST_SIGN`, `THEATRE_CANCEL`

---

## 3. Endpoints Specification

### 3.1 Theatre Suite Configuration

#### `POST /theatre/theatres`
Registers an operating theatre or surgical suite.
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "code": "TH-MAIN-01",
    "name": "Main Operating Theatre 1",
    "theatreType": "MAJOR"
  }
  ```
- **Response `201 Created`:** Created theatre suite record.

#### `GET /theatre/theatres`
Lists operating theatres with current availability.
- **Query Parameters:** `facilityId` (optional)

---

### 3.2 Surgical Booking & Scheduling

#### `POST /theatre/bookings`
Schedules an elective or emergency surgical procedure.
- **Conflict Guard:** Checks for existing non-cancelled bookings on the same `theatreId` where `(scheduledStartTime < newEndTime) AND (scheduledEndTime > newStartTime)`. If collision detected, rejects with `409 Conflict: Theatre suite is already booked for this time slot`.
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "theatreId": "5e1823bb-7721-4890-a782-b1cf889a0122",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "procedureName": "Open Emergency Appendectomy",
    "leadSurgeonId": "d8226227-54f9-4525-b4a7-977e232e0a92",
    "anesthetistId": "a9018274-1234-4567-8901-bcdef1234567",
    "scheduledStartTime": "2026-10-23T08:00:00.000Z",
    "scheduledEndTime": "2026-10-23T10:30:00.000Z",
    "urgency": "EMERGENCY"
  }
  ```
- **Response `201 Created`:** Booking record with `bookingNumber` (e.g. `THB-202610-0001`) and status `SCHEDULED`.

#### `PATCH /theatre/bookings/:id/status`
Advances procedure status through perioperative stages:
- **Request Body:**
  ```json
  {
    "status": "IN_PROCEDURE"
  }
  ```

#### `POST /theatre/bookings/:id/cancel`
Cancels or postpones a scheduled surgical procedure.
- **Request Body:**
  ```json
  {
    "cancellationReason": "Patient hypertensive pre-op (BP 210/120), procedure deferred for medical optimization."
  }
  ```

---

### 3.3 WHO Surgical Safety Checklist Attestations

#### `POST /theatre/bookings/:id/checklist/sign-in`
Attestation conducted before induction of anesthesia (Patient identity confirmed, site marked, pulse oximeter on, allergy check, airway risk check).
- **Request Body:**
  ```json
  {
    "patientIdentityConfirmed": true,
    "siteMarked": true,
    "anesthesiaSafetyCheckCompleted": true,
    "pulseOximeterFunctioning": true,
    "knownAllergies": false,
    "difficultAirwayRisk": false,
    "bloodLossRiskAnticipated": false,
    "signOffNotes": "Sign-in verified by Anesthetist and Circulating Nurse"
  }
  ```

#### `POST /theatre/bookings/:id/checklist/time-out`
Attestation conducted before skin incision (Team introduction, confirming patient name, procedure, incision site, antibiotic prophylaxis given within 60 min, imaging displayed).
- **Request Body:**
  ```json
  {
    "teamIntroducedByRole": true,
    "surgeonAnesthetistNurseConfirmPatient": true,
    "procedureAndSiteConfirmed": true,
    "antibioticProphylaxisWithin60Min": true,
    "criticalStepsAnticipated": true,
    "imagingDisplayed": true,
    "signOffNotes": "Time-out confirmed before incision"
  }
  ```

#### `POST /theatre/bookings/:id/checklist/sign-out`
Attestation conducted before patient leaves operating room (Procedure recorded, needle/sponge/instrument counts correct, specimen labeled, postop recovery plan).
- **Request Body:**
  ```json
  {
    "nameOfProcedureRecorded": true,
    "instrumentSpongeNeedleCountsCorrect": true,
    "specimenCorrectlyLabeled": true,
    "equipmentProblemsAddressed": false,
    "postopRecoveryKeyConcernsReviewed": true,
    "signOffNotes": "Counts correct. Patient stable for transfer to PACU."
  }
  ```
