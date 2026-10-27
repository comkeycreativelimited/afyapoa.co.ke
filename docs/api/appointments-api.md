# COMKEY AFYA POA — Appointments & Outpatient Scheduling API Documentation

## 1. Overview & Operational Principles

The **Appointments and Scheduling Module** coordinates outpatient clinical visits, practitioner consultation calendars, and clinic flow under:
1. **Kenya Medical Practitioners and Dentists Council (KMPDC) Code of Professional Conduct**.
2. **Practitioner Conflict Prevention:** Enforces non-overlapping consultation windows per practitioner. Any attempt to double-book the same clinician in overlapping time windows returns `409 Conflict`.
3. **Outpatient Consultation Lifecycle:** Tracks consultations through progression:
   `SCHEDULED` -> `CONFIRMED` -> `CHECKED_IN` -> `IN_CONSULTATION` -> `COMPLETED`, or `CANCELLED` / `NO_SHOW`.
4. **Structured Cancellation Tracking:** Preserves the distinction between completed and cancelled visits, mandating recorded reasons for clinic quality audits.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `APPOINTMENTS_READ`: View appointment worklists and practitioner schedules.
- `APPOINTMENTS_SCHEDULE`: Book new outpatient or specialist consultations.
- `APPOINTMENTS_UPDATE`: Check in patients and progress through consult stages.
- `APPOINTMENTS_CANCEL`: Cancel booked appointments with mandatory justification.

---

## 3. Endpoints Specification

### 3.1 Scheduling & Lifecycle Transitions

#### `POST /appointments`
Schedules a clinical consultation.
- **Double-Booking Guard:** Checks existing active bookings for `practitionerId` where `(scheduledStartTime < newEndTime) AND (scheduledEndTime > newStartTime)`. If collision detected, returns `409 Conflict: Practitioner is already booked for this consultation window`.
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "practitionerId": "d8226227-54f9-4525-b4a7-977e232e0a92",
    "scheduledStartTime": "2026-10-24T09:00:00.000Z",
    "scheduledEndTime": "2026-10-24T09:30:00.000Z",
    "serviceType": "SPECIALIST_CLINIC"
  }
  ```
- **Response `201 Created`:** Booking record with `appointmentNumber` (e.g. `APT-202610-0001`) and status `SCHEDULED`.

#### `GET /appointments`
Lists scheduled appointments with date range, practitioner, and status filters.
- **Permission:** `APPOINTMENTS_READ`
- **Query Parameters:** `facilityId`, `practitionerId`, `patientId`, `startDate`, `endDate`, `status`

#### `PATCH /appointments/:id/status`
Advances appointment status as patient progresses through the clinic:
- **Request Body:**
  ```json
  {
    "status": "CHECKED_IN"
  }
  ```

#### `POST /appointments/:id/cancel`
Cancels an appointment.
- **Request Body:**
  ```json
  {
    "cancellationReason": "Patient rescheduled due to work travel."
  }
  ```
- **Response `201 Created`:** Updates status to `CANCELLED` and releases the practitioner's calendar slot.
