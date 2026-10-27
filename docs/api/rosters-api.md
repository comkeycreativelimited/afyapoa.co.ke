# COMKEY AFYA POA — Staff Rosters & Departmental Assignments API Documentation

## 1. Overview & Labor Standards

The **Staff Rosters and Departmental Assignments Module** organizes healthcare personnel, hospital departmental hierarchies, and monthly shift scheduling under:
1. **Employment Act 2007** of the Laws of Kenya governing working hours, rest periods, and overtime.
2. **Nursing Council of Kenya (NCK) Standards of Nursing Practice** and KMPDC clinical staffing norms for acute inpatient care, night coverage, and on-call rotations.
3. **Multi-Departmental Structure:** Supports clinical departments (Emergency, ICU, Maternity, Internal Medicine, Surgery, Pediatrics) and operational departments (Pharmacy, Laboratory, Radiology, Records).
4. **Shift Distribution:** Supports standard hospital shift types:
   - `MORNING` (07:00 – 14:00)
   - `AFTERNOON` (14:00 – 21:00)
   - `NIGHT` (20:30 – 07:30)
   - `ON_CALL` (24-hour consultant standby)
   - `OFF_DUTY`
   - `LEAVE` (Annual, Maternity, Sick)
5. **Publishing Audit Trail:** Rosters remain in `DRAFT` state during authoring and advance to `PUBLISHED` upon formal administrative sign-off, emitting a permanent audit event.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `ROSTER_READ`: View departmental rosters and personal assigned shifts.
- `ROSTER_MANAGE`: Create departmental rosters, assign shifts, and update drafts (Matrons, Nursing Officers in Charge, Heads of Department).
- `ROSTER_PUBLISH`: Formally authorize and publish departmental rosters for operational effect (Hospital Admin, Medical Director).

---

## 3. Endpoints Specification

### 3.1 Departmental Hierarchy

#### `POST /rosters/departments`
Configures a hospital department.
- **Permission:** `HOSPITAL_ADMIN`
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "code": "DEP-ICU",
    "name": "Intensive Care Unit"
  }
  ```
- **Response `201 Created`:** Created department record.

#### `GET /rosters/departments`
Lists hospital departments for the facility.
- **Permission:** `ROSTER_READ`

---

### 3.2 Monthly Roster Management & Shifts

#### `POST /rosters`
Creates a monthly roster draft for a department.
- **Permission:** `ROSTER_MANAGE`
- **Request Body:**
  ```json
  {
    "departmentId": "4b918274-1234-4567-8901-abcdef123456",
    "month": "NOVEMBER",
    "year": 2026
  }
  ```
- **Response `201 Created`:** Roster record with initial status `DRAFT`.

#### `POST /rosters/:id/shifts`
Allocates a duty shift to a healthcare worker.
- **Permission:** `ROSTER_MANAGE`
- **Request Body:**
  ```json
  {
    "staffId": "d8226227-54f9-4525-b4a7-977e232e0a92",
    "shiftDate": "2026-11-01",
    "shiftType": "MORNING"
  }
  ```
- **Response `201 Created`:** Assigned shift record and emitted `SHIFT_ASSIGNED` audit event.

#### `POST /rosters/:id/publish`
Formally approves and publishes the monthly roster.
- **Permission:** `ROSTER_PUBLISH`
- **Response `201 Created`:** Transitions status to `PUBLISHED`, stamps `publishedAt` and `publishedByUserId`, and emits `ROSTER_PUBLISHED` audit event.

#### `GET /rosters/:id/shifts`
Retrieves all scheduled shifts for the roster period.
- **Permission:** `ROSTER_READ`
- **Query Parameters:** `staffId` (optional for personal shift view), `shiftDate`
