# COMKEY AFYA POA — Maternity & Newborn Workflows API Documentation

## 1. Overview & Clinical Context

The **Maternity and Newborn Workflows Module** provides clinical operations and documentation for obstetric and neonatal care in compliance with:
1. **Kenya National Clinical Guidelines for Maternal and Newborn Health (MOH Kenya)**.
2. **Maternal and Perinatal Death Surveillance and Response (MPDSR)** statutory tracking requirements.
3. **Partograph Intrapartum Monitoring:** Captures active labor parameters: cervical dilation, fetal head descent, uterine contractions frequency/duration, and fetal heart rate.
4. **Neonatal Evaluation & APGAR Scoring:** APGAR scores recorded at 1 minute, 5 minutes, and 10 minutes post-delivery.
5. **Automatic Newborn Registration:** Registering a newborn profile automatically issues a new, unique Medical Record Number (MRN) and generates a linked child `patient` record in the master registry.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `MATERNITY_READ`: View delivery summaries and newborn profiles.
- `MATERNITY_RECORD_DELIVERY`: Document maternal intrapartum deliveries and partographs.
- `MATERNITY_NEWBORN_REGISTER`: Record neonatal birth outcomes, APGAR scores, and auto-provision patient profiles.

---

## 3. Endpoints Specification

### 3.1 Maternity Deliveries

#### `POST /maternity/deliveries`
Documents an obstetric delivery.
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "admissionId": "ad9f8841-8971-45c1-90a2-1cbffc3d9021",
    "deliveryDate": "2026-10-22T14:45:00.000Z",
    "deliveryMode": "SPONTANEOUS_VAGINAL",
    "deliveryOutcome": "LIVE_BIRTH",
    "estimatedBloodLossMl": "250.00",
    "perinealTear": "FIRST_DEGREE",
    "conductedByUserId": "d8226227-54f9-4525-b4a7-977e232e0a92",
    "partographSummary": {
      "initialDilationCm": 4,
      "fullDilationHours": 6,
      "fetalHeartRateBaseline": 142,
      "contractionsPer10Min": 4,
      "membranesRupturedTime": "2026-10-22T12:00:00.000Z",
      "liquorColor": "CLEAR"
    }
  }
  ```
- **Response `201 Created`:** Created delivery record with UUID.

#### `GET /maternity/deliveries`
Lists maternal deliveries for the facility.
- **Query Parameters:** `facilityId`, `patientId`

---

### 3.2 Newborn Profiles & Master Registry Auto-Provisioning

#### `POST /maternity/deliveries/:id/newborns`
Registers a newborn delivered in the facility.
- **Automated Workflow:**
  1. Creates a new child entry in the master `patients` table with firstName, lastName, gender, and dateOfBirth matching delivery.
  2. Generates an official unique Medical Record Number (`MRN-NB-YYYYMM-XXXX`).
  3. Records the `newborn_profiles` entry with APGAR scores (1 min, 5 min, 10 min), birth weight, and head circumference, linked to both the mother's delivery record and the newborn's patient record.
- **Request Body:**
  ```json
  {
    "babyGender": "MALE",
    "babyFirstName": "Baby of Amina",
    "birthOrder": "SINGLETON",
    "apgar1min": 8,
    "apgar5min": 9,
    "apgar10min": 10,
    "birthWeightGrams": "3450.00"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "e44181a9-34bc-4501-9a72-bcdef0123456",
      "deliveryId": "fa918bca-7741-456c-8e43-851cb99a4c11",
      "patientId": "c88219ba-1234-4567-8901-abcdef012345",
      "babyMrn": "MRN-NB-202610-0042",
      "birthOrder": "SINGLETON",
      "apgar1min": 8,
      "apgar5min": 9,
      "apgar10min": 10,
      "birthWeightGrams": "3450.00",
      "status": "ACTIVE"
    }
  }
  ```

#### `GET /maternity/deliveries/:id/newborns`
Retrieves all newborn profiles linked to a maternal delivery.
