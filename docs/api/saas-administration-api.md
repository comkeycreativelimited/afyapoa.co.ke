# COMKEY AFYA POA — Commercial SaaS Administration API Reference

This document provides the complete API specification for the Commercial SaaS Administration domain of COMKEY AFYA POA.

---

## 1. Platform Administration Endpoints (`/api/v1/platform/*`)
*Restricted to Platform Super Administrators (`SUPER_ADMIN`).*

### 1.1 Tenant Onboarding & Facility Setup
#### `POST /api/v1/platform/tenants/onboard`
Onboards a new hospital tenant, registers its primary KMFL health facility, creates the initial hospital administrator account, and provisions the default subscription matching the facility's KEPH level.

- **Request Headers**: `Authorization: Bearer <superAdminToken>`
- **Request Body (`OnboardTenantDto`)**:
  ```json
  {
    "code": "tenant-nakuru-west",
    "name": "Nakuru West Sub-County Hospital",
    "tier": "STANDARD",
    "facilityKmflCode": "FID-04-000404-4",
    "facilityName": "Nakuru West Referral Hospital",
    "facilityLevel": "LEVEL_4",
    "county": "Nakuru",
    "subCounty": "Nakuru West",
    "physicalAddress": "Nakuru-Eldoret Highway, Nakuru",
    "contactPhone": "+254711000404",
    "contactEmail": "admin@nakuruwest.demo.afyapoa.co.ke",
    "shaContractCode": "SHA-CTR-00404",
    "kraPin": "P054000404N",
    "adminUsername": "admin.nakuru",
    "adminEmail": "admin@nakuruwest.demo.afyapoa.co.ke",
    "adminFullName": "Dr. Kevin Kiprop",
    "adminPassword": "Password123!"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "tenant": { "id": "...", "code": "tenant-nakuru-west", "name": "...", "status": "ACTIVE" },
    "facility": { "id": "...", "kmflCode": "FID-04-000404-4", "name": "...", "level": "LEVEL_4" },
    "adminUser": { "id": "...", "username": "admin.nakuru", "role": "FACILITY_ADMIN" },
    "subscriptionId": "..."
  }
  ```

---

### 1.2 Subscription Plan Catalog Management
#### `POST /api/v1/platform/plans`
Defines a new subscription plan with facility level, pricing, quotas, and feature entitlements.
- **Request Body (`CreateSubscriptionPlanDto`)**:
  ```json
  {
    "code": "PLAN-ENTERPRISE-KES",
    "name": "Hospital Enterprise Comprehensive Tier",
    "facilityLevel": "LEVEL_5",
    "billingCycle": "ANNUAL",
    "basePriceKes": 95000,
    "maxUsers": 150,
    "maxMonthlyEncounters": 15000,
    "maxStorageGb": 1000,
    "features": {
      "inpatient": true,
      "theatre": true,
      "maternity": true,
      "radiology": true,
      "procurement": true,
      "privateInsurance": true,
      "dhaShr": true,
      "kraEtims": true,
      "advancedRosters": true
    }
  }
  ```

#### `PATCH /api/v1/platform/plans/:id`
Updates pricing or capacity limits for an existing subscription plan.

---

### 1.3 Platform Invoicing & Dunning Simulation
#### `POST /api/v1/platform/invoices`
Issues a platform invoice with standard 16% Kenyan VAT and line-item attribution.
- **Request Body (`IssuePlatformInvoiceDto`)**:
  ```json
  {
    "tenantId": "083d4497-0a73-4d1c-b55f-8a618cbffc3d",
    "subscriptionId": "69176161-fa8d-4a17-b089-ce23e1e550cb",
    "dueDate": "2026-11-30T23:59:59Z",
    "idempotencyKey": "INV-IDEM-202611-001",
    "items": [
      { "description": "Enterprise Monthly Subscription", "unitPriceKes": 95000, "quantity": 1 },
      { "description": "Dedicated Gateway Support", "unitPriceKes": 15000, "quantity": 1 }
    ]
  }
  ```
- **Response `201 Created`**: Returns computed subtotal (`110000.00`), VAT (`17600.00`), and total (`127600.00`).

#### `POST /api/v1/platform/invoices/:id/simulate-failure`
Executes failed payment handling and progresses the 5-stage dunning engine.

---

### 1.4 Reporting & Integration Monitoring
#### `GET /api/v1/platform/reports/subscriptions`
Calculates platform Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), active tenant counts, and tier distribution.

#### `POST /api/v1/platform/reconciliation/run`
Executes automated financial reconciliation comparing all recorded platform payments against issued invoices.

#### `GET /api/v1/platform/health/status`
Reports component health status (PostgreSQL latency, Redis, asynchronous job queues, and national integration health).

#### `GET /api/v1/platform/metrics/integrations`
Reports real-time latency percentiles (p50, p95, p99), error rates, and uptime for national gateways:
- Digital Health Agency Shared Health Record (DHA SHR)
- Social Health Authority Claims Gateway (SHA)
- KRA Electronic Tax Invoice Management System (eTIMS)
- Safaricom Daraja M-Pesa Gateway

---

## 2. Hospital Tenant SaaS Endpoints (`/api/v1/saas/*`)
*Restricted to Hospital Administrators (`FACILITY_ADMIN`) and Finance Users (`FINANCE_USER`).*

### 2.1 Subscription & Plan Operations
#### `GET /api/v1/saas/subscription`
Retrieves current subscription status, billing cycle, current period dates, and active entitlements.

#### `POST /api/v1/saas/subscription/upgrade`
Upgrades subscription plan tier with immediate entitlement synchronization.
- **Request Body (`UpgradePlanDto`)**:
  ```json
  {
    "newPlanId": "...",
    "reason": "Expanding into Level 5 referral hospital operations"
  }
  ```

#### `POST /api/v1/saas/subscription/downgrade`
Downgrades subscription plan. Server enforces capacity guards to ensure active resources do not exceed target plan quotas.

---

### 2.2 Usage Metering
#### `POST /api/v1/saas/usage/record`
Records metered consumption with automatic monthly aggregation and audit tracking.
- **Request Body (`RecordUsageDto`)**:
  ```json
  {
    "metricType": "ENCOUNTERS",
    "quantity": 250,
    "details": { "source": "OPD_REGISTRATION" }
  }
  ```

#### `GET /api/v1/saas/usage`
Returns current billing cycle utilization, remaining quota, 80% warning alerts, and 100% hard limit indicators.

---

### 2.3 Invoices & M-Pesa Payments
#### `GET /api/v1/saas/invoices`
Lists all platform invoices issued to the calling tenant organization.

#### `POST /api/v1/saas/invoices/:id/pay`
Processes invoice settlement via M-Pesa STK push.
- **Request Body (`ProcessPlatformPaymentDto`)**:
  ```json
  {
    "amountKes": 127600,
    "paymentMethod": "MPESA",
    "phoneNumber": "+254712345678",
    "idempotencyKey": "PAY-IDEM-202611-0001"
  }
  ```

---

### 2.4 Administrative Support & Auditable Access
#### `POST /api/v1/saas/support/cases`
Submits an administrative support case (`BILLING_ENQUIRY`, `INTEGRATION_ISSUE`, `ENTITLEMENT_ADJUSTMENT`, `FEATURE_REQUEST`).

#### `POST /api/v1/saas/support/cases/:id/messages`
Appends a threaded reply to an existing support ticket.

#### `POST /api/v1/saas/support/access-grants`
Generates a time-bound (max 24h) cryptographic support access grant for COMKEY platform engineers.
- **Request Body (`GrantSupportAccessDto`)**:
  ```json
  {
    "supportUserId": "...",
    "facilityId": "...",
    "scope": "READ_ONLY",
    "durationHours": 4,
    "reason": "Troubleshooting DHA client registry token synchronization"
  }
  ```

#### `POST /api/v1/saas/support/access-grants/:id/revoke`
Immediately terminates an active support grant.

---

### 2.5 Offboarding Workflows
#### `POST /api/v1/saas/offboarding/request`
Initiates facility offboarding and establishes statutory 10-year medical records archive retention as required by Section 7 of the Health Act 2017.
