# COMKEY AFYA POA — Pharmacy & Medication-Dispensing API Documentation

## 1. Overview & Architecture

The **Pharmacy and Medication-Dispensing Module** (Milestone 8) implements digital pharmacy operations for the COMKEY AFYA POA Kenya Multi-Tenant HMIS SaaS platform.

It adheres to:
1. **Kenyan Pharmacy and Poisons Board (PPB) Cap 244** regulations governing prescription drug schedules (`PART_1_POISON`, `PART_2_POISON`, `OVER_THE_COUNTER`, `CONTROLLED_NARCOTIC`) and supplier premise licenses (`PPB/PREM/...`).
2. **Kenya Essential Medicines List (KEML 2023 8th Edition)** standard cataloguing and WHO Anatomical Therapeutic Chemical (ATC) classification.
3. **First-Expiring, First-Out (FEFO)** automated batch allocation rules.
4. **Database Row-Level Locking (`SELECT ... FOR UPDATE`)** inside transactions preventing negative inventory and simultaneous duplicate dispenses.
5. **Separation of Concerns:** Distinct models for `medication_requests` (prescribing), `medication_dispenses` (dispensary fulfillment), and `medication_administrations` (bedside nursing delivery).
6. **Immutable Audit Ledger:** All inventory deductions and receipts are recorded as explicit records in `pharmacy_stock_movements`, completely eliminating silent quantity overwrites.
7. **HL7 FHIR R4 Interoperability:** Clean serialization to `Medication`, `MedicationDispense`, and `MedicationAdministration` conforming to Kenya Core digital health profiles.

---

## 2. Authentication & Authorization

All endpoints require a valid JWT Bearer token in the `Authorization` header:
```http
Authorization: Bearer <jwt_access_token>
```

Tenant context is automatically extracted from JWT claims (`x-tenant-id`, `x-facility-id`, `x-user-id`) and applied directly to PostgreSQL Row-Level Security (`app.current_tenant_id`).

### Required Permissions:
- `PHARMACY_READ`: View products, suppliers, inventory batches, prescription worklists, stock movements, and alerts.
- `PHARMACY_CATALOGUE_WRITE`: Create or modify products and suppliers (Hospital Admin, Chief Pharmacist).
- `PHARMACY_STOCK_RECEIVE`: Receive stock from suppliers into inventory batches.
- `PHARMACY_DISPENSE`: Fulfill prescriptions, record partial/full dispenses, and process controlled returns.
- `PHARMACY_STOCK_TRANSFER`: Transfer batches between authorized facilities.
- `PHARMACY_STOCK_ADJUST`: Perform controlled reconciliation adjustments with justification.
- `MEDICATION_ADMINISTER`: Record bedside nursing administration events.

---

## 3. Endpoints Specification

### 3.1 Catalogue Management & Seeding

#### `POST /pharmacy/catalogue/seed`
Idempotently seeds standard KEML 2023 medicines and licensed PPB suppliers (KEMSA, MEDS, Cosmos, Dawa) for the tenant.
- **Permission:** `PHARMACY_CATALOGUE_WRITE`
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Pharmacy catalogue initialized successfully",
      "seededProducts": 10,
      "seededSuppliers": 4
    }
  }
  ```

#### `GET /pharmacy/products`
Retrieves products with optional search query, category, drug schedule, or active filter.
- **Permission:** `PHARMACY_READ`
- **Query Parameters:** `search`, `category`, `drugSchedule`, `isActive`
- **Response `200 OK`:** Array of `PharmacyProduct` objects.

#### `POST /pharmacy/products`
Registers a custom medical product or device.
- **Permission:** `PHARMACY_CATALOGUE_WRITE`
- **Payload:**
  ```json
  {
    "itemCode": "MED-IBU-400",
    "genericName": "Ibuprofen",
    "brandName": "Brufen",
    "atcCode": "M01AE01",
    "drugSchedule": "PART_2_POISON",
    "category": "ORAL_SOLID",
    "form": "Film-coated Tablet",
    "strength": "400",
    "strengthUnit": "mg",
    "dispensingUnit": "TABLET",
    "packagingUnit": "BLISTER_PACK",
    "packagingSize": 100,
    "storageCondition": "ROOM_TEMPERATURE",
    "unitPrice": 6.50,
    "reorderLevel": 100
  }
  ```
- **Response `201 Created`**

#### `PATCH /pharmacy/products/:id`
Updates pricing, reorder thresholds, or active status.
- **Permission:** `PHARMACY_CATALOGUE_WRITE`
- **Response `200 OK`**

#### `GET /pharmacy/suppliers`
Lists authorized pharmaceutical suppliers with PPB license and KRA PIN details.
- **Permission:** `PHARMACY_READ`
- **Response `200 OK`**

---

### 3.2 Inventory Receipts & Batch Tracking

#### `POST /pharmacy/inventory/receive`
Records a procurement consignment receipt from a supplier, creating/updating an inventory batch and writing an immutable `RECEIPT` record to `pharmacy_stock_movements`.
- **Permission:** `PHARMACY_STOCK_RECEIVE`
- **Payload:**
  ```json
  {
    "productId": "4fae89bb-0648-4cb9-99ff-882200112233",
    "batchNumber": "BATCH-AMX-2026-01",
    "manufacturer": "Cosmos Pharmaceuticals Ltd",
    "expiryDate": "2028-12-31T00:00:00.000Z",
    "quantityReceived": 500,
    "unitCost": 8.50,
    "sellingPrice": 12.00,
    "supplierId": "9fae89bb-0648-4cb9-99ff-882200112299",
    "storageBin": "DISP-SHELF-A2",
    "notes": "Consignment #KEMSA/2026/NBI-04"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "batchId": "uuid",
      "batchNumber": "BATCH-AMX-2026-01",
      "quantityOnHand": 500,
      "movementId": "uuid"
    }
  }
  ```

#### `GET /pharmacy/batches`
Lists inventory batches ordered by expiry date (FEFO sequence) for the facility.
- **Permission:** `PHARMACY_READ`
- **Query Parameters:** `productId`, `status`
- **Response `200 OK`:** Array of batch items including `daysToExpiry` and `quantityOnHand`.

#### `GET /pharmacy/batches/:id`
Retrieves detailed batch inventory metadata.
- **Permission:** `PHARMACY_READ`
- **Response `200 OK`**

---

### 3.3 Prescription Worklist & Dispensing

#### `GET /pharmacy/prescriptions/worklist`
Returns active CPOE medication orders awaiting fulfillment, calculating fulfilled quantities and remaining balances.
- **Permission:** `PHARMACY_READ`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "orderId": "uuid",
        "orderNumber": "ORD-202610-1042",
        "patientName": "Juma Bakari",
        "patientMrn": "NMH-2026-0814",
        "medicationRequestId": "uuid",
        "medicationCode": "J01CA04",
        "medicationName": "Amoxicillin 500mg capsule",
        "quantityPrescribed": 15,
        "quantityDispensed": 0,
        "quantityRemaining": 15,
        "fulfillmentStatus": "PENDING"
      }
    ]
  }
  ```

#### `POST /pharmacy/dispense`
Dispensary execution endpoint. Uses database row locks (`SELECT ... FOR UPDATE`) to prevent negative stock and double-dispensing.
- **Permission:** `PHARMACY_DISPENSE`
- **Payload:**
  ```json
  {
    "orderId": "uuid",
    "medicationRequestId": "uuid",
    "patientId": "uuid",
    "quantityToDispense": 15,
    "batchId": "optional-uuid-override",
    "daysSupply": 5,
    "dosageInstructions": "Take 1 capsule 3 times daily after meals for 5 days",
    "patientCounselingNotes": "Ensure full 5-day course is completed even if symptoms resolve."
  }
  ```
- **FEFO Allocation Logic:**
  - If `batchId` is omitted, the system queries active batches ordered by `expiryDate ASC` and automatically allocates from the earliest-expiring batch with unreserved stock.
  - Multi-batch split is executed automatically if a single batch cannot fulfill the requested quantity.
- **Partial Dispensing Rules:**
  - If `quantityToDispense < remaining`, records `PARTIAL` dispense and leaves remainder on prescription worklist.
  - Subsequent fulfillment completes the remaining balance as `BALANCE_COMPLETION`.
  - Attempts to dispense exceeding remaining prescribed quantity throw `400 Bad Request`.
  - Attempts to dispense against cancelled clinical orders throw `400 Bad Request`.
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "dispense": {
        "id": "uuid",
        "dispenseNumber": "DISP-2026-00412",
        "status": "COMPLETED",
        "dispenseType": "FULL",
        "quantityDispensed": 15,
        "quantityRemaining": 0
      },
      "items": [
        {
          "batchId": "uuid",
          "quantityDispensed": 15,
          "unitPrice": "12.00",
          "totalPrice": "180.00"
        }
      ]
    }
  }
  ```

---

### 3.4 Controlled Returns & Reversals

#### `POST /pharmacy/dispense/return`
Reverses a previously completed dispensation.
- **Permission:** `PHARMACY_DISPENSE`
- **Payload:**
  ```json
  {
    "dispenseId": "uuid",
    "reason": "Patient experienced hypersensitivity prior to leaving dispensary counter; returned intact box",
    "notes": "Verified by Lead Pharmacist Faith Njeri"
  }
  ```
- **Requirements:**
  - Justification reason must be at least 10 characters long (Kenyan PPB regulatory requirement).
  - Atomically marks the dispense as `ENTERED_IN_ERROR`.
  - Re-increments on-hand inventory on the deducted batches.
  - Writes an explicit `RETURN_TO_STOCK` movement to `pharmacy_stock_movements`.
- **Response `201 Created`**

---

### 3.5 Inter-Facility Transfers & Reconciliation

#### `POST /pharmacy/inventory/transfer`
Transfers physical stock between facilities under the same tenant.
- **Permission:** `PHARMACY_STOCK_TRANSFER`
- **Payload:**
  ```json
  {
    "batchId": "uuid",
    "quantity": 25,
    "destinationFacilityId": "uuid",
    "reason": "Replenishment transfer to Community Health Centre"
  }
  ```
- **Response `201 Created`:** Generates paired `TRANSFER_OUT` and `TRANSFER_IN` audit records.

#### `POST /pharmacy/inventory/adjust`
Controlled inventory reconciliation adjustment for damaged goods, expired stock, or physical count variance.
- **Permission:** `PHARMACY_STOCK_ADJUST`
- **Payload:**
  ```json
  {
    "batchId": "uuid",
    "movementType": "ADJUSTMENT_DAMAGE",
    "quantityDelta": -5,
    "reason": "Water damage from broken dispensary pipe during monsoon storm"
  }
  ```
- **Validation:** Adjustments resulting in negative inventory are strictly rejected with `400 Bad Request`.
- **Response `201 Created`**

---

### 3.6 Bedside Medication Administration

#### `POST /pharmacy/administration`
Records a clinical bedside administration event performed by ward nurses.
- **Permission:** `MEDICATION_ADMINISTER`
- **Payload:**
  ```json
  {
    "medicationRequestId": "uuid",
    "encounterId": "uuid",
    "patientId": "uuid",
    "doseQuantity": 500,
    "doseUnit": "mg",
    "route": "ORAL",
    "site": "Mouth",
    "status": "COMPLETED",
    "notes": "Administered with water; patient tolerated well without nausea"
  }
  ```
- **Response `201 Created`**

#### `GET /pharmacy/administrations`
Lists bedside administration history for an encounter or patient chart.
- **Permission:** `PHARMACY_READ`
- **Query Parameters:** `encounterId`, `patientId`
- **Response `200 OK`**

---

### 3.7 Auditing, Valuation & Alerts

#### `GET /pharmacy/movements`
Queries the chronological audit ledger of all pharmaceutical movements.
- **Permission:** `PHARMACY_READ`
- **Query Parameters:** `productId`, `batchId`, `limit`
- **Response `200 OK`**

#### `GET /pharmacy/valuation`
Calculates total inventory valuation at acquisition cost and retail selling price, computing gross profit margin.
- **Permission:** `PHARMACY_READ`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "totalAcquisitionCost": 452800.00,
      "totalRetailValue": 684200.00,
      "potentialGrossMargin": 231400.00,
      "activeBatchesCount": 42
    }
  }
  ```

#### `GET /pharmacy/alerts/expiry`
Returns inventory batches expired or expiring within the specified day threshold (default: 90 days).
- **Permission:** `PHARMACY_READ`
- **Query Parameters:** `daysThreshold`
- **Response `200 OK`**

#### `GET /pharmacy/alerts/low-stock`
Returns products whose cumulative on-hand inventory across batches is at or below the reorder threshold.
- **Permission:** `PHARMACY_READ`
- **Response `200 OK`**

---

### 3.8 HL7 FHIR R4 Serialization Endpoints

#### `GET /pharmacy/fhir/medication/:id`
Exports a product as an authentic HL7 FHIR R4 `Medication` resource with KEML and ATC coding systems.

#### `GET /pharmacy/fhir/dispense/:id`
Exports a completed dispense event as an HL7 FHIR R4 `MedicationDispense` resource conforming to the Kenya Core profile (`http://health.go.ke/fhir/StructureDefinition/kenya-medication-dispense`).

#### `GET /pharmacy/fhir/administration/:id`
Exports a bedside administration record as an HL7 FHIR R4 `MedicationAdministration` resource conforming to the Kenya Core profile.
