# COMKEY AFYA POA — Medical Supplies & Procurement Intake API Documentation

## 1. Overview & Statutory Standards

The **Medical Supplies and Procurement Module** implements institutional health procurement under:
1. **Pharmacy and Poisons Act (Cap 244)** for licensed pharmaceutical batch handling.
2. **Public Procurement and Asset Disposal Act (PPADA)** and private hospital internal financial controls.
3. **Dual-Sign Purchase Order Approval:** Strict segregation of duties where purchase orders created by procurement officers require independent administrative/financial review and electronic sign-off before vendor transmission.
4. **Goods Received Note (GRN) with Quality Inspection:** Physical deliveries undergo QA inspection (`ACCEPTED`, `PARTIALLY_ACCEPTED`, `REJECTED`), capture manufacturer batch/lot control numbers, verify expiry dates, and assign designated warehouse storage bins.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `PROCUREMENT_READ`: View purchase orders, inventory requisitions, and GRNs.
- `PROCUREMENT_CREATE`: Author and submit purchase orders.
- `PROCUREMENT_APPROVE`: Authorize and approve purchase orders (Hospital Admin, Medical Director).
- `PROCUREMENT_RECEIVE`: Record physical goods intake, inspection outcomes, batch/expiry logging, and bin allocation.

---

## 3. Endpoints Specification

### 3.1 Purchase Orders & Dual-Sign Approval

#### `POST /procurement/orders`
Creates a new purchase order with detailed consumable and medicine line items.
- **Permission:** `PROCUREMENT_CREATE`
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "supplierName": "Mission for Essential Drugs and Supplies (MEDS)",
    "items": [
      {
        "itemName": "Surgical Gloves Size 7.5 Powder-Free",
        "itemType": "SURGICAL_SUPPLY",
        "quantityOrdered": 500,
        "unitPrice": "45.00"
      },
      {
        "itemName": "Normal Saline 0.9% 500ml IV Infusion",
        "itemType": "MEDICATION",
        "quantityOrdered": 200,
        "unitPrice": "85.00"
      }
    ]
  }
  ```
- **Response `201 Created`:** Order with `poNumber` (e.g. `PO-202610-0001`), computed `totalAmount` (`39500.00`), and initial status `SUBMITTED`.

#### `POST /procurement/orders/:id/approve`
Independent administrative sign-off executing the dual-sign invariant.
- **Permission:** `PROCUREMENT_APPROVE`
- **Request Body:**
  ```json
  {
    "notes": "Approved in accordance with Q4 consumable budget allocation."
  }
  ```
- **Response `201 Created`:** Transitions status to `APPROVED`, records `approvedByUserId` and `approvedAt`, and emits `PROCUREMENT_ORDER_APPROVED` audit event.

---

### 3.2 Goods Received Notes (GRN) Intake

#### `POST /procurement/grn`
Records warehouse physical intake and quality verification.
- **Permission:** `PROCUREMENT_RECEIVE`
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "procurementOrderId": "518b5f3a-c275-4db0-9823-3c9384e8a88f",
    "deliveryNoteNumber": "DN-MEDS-88910",
    "inspectionStatus": "ACCEPTED",
    "batchLotNumber": "LOT-2026-NS-991",
    "expiryDate": "2028-09-30",
    "storageBinLocation": "BIN-C-04-SHELF-2"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "d9f68ba3-482b-43e1-ab92-5fca6addd865",
      "grnNumber": "GRN-202610-0001",
      "inspectionStatus": "ACCEPTED",
      "storageBinLocation": "BIN-C-04-SHELF-2",
      "receivedAt": "2026-10-22T15:03:39.775Z"
    }
  }
  ```
- **Side Effect:** Automatically advances the parent purchase order to `RECEIVED` (or `PARTIALLY_RECEIVED`) and records a `GOODS_RECEIVED_RECORDED` audit entry.

#### `GET /procurement/grn`
Lists all goods received vouchers for inventory reconciliation.
