# COMKEY AFYA POA — Healthcare Management Information System (HMIS)

[![CI Pipeline](https://github.com/comkeycreativelimited/afyapoa.co.ke/actions/workflows/ci.yml/badge.svg)](https://github.com/comkeycreativelimited/afyapoa.co.ke/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/Node.js-20%20LTS-brightgreen.svg)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-10.30.2-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![DPA Reg 26 Compliant](https://img.shields.io/badge/Kenya%20DPA%202019-Reg%2026%20Localized-emerald.svg)](https://www.odpc.go.ke/)

**COMKEY AFYA POA** is an enterprise-grade, cloud-first, multi-tenant Health Management Information System (HMIS) software-as-a-service platform purpose-built for the Kenyan healthcare ecosystem (Levels 2 through 6).

> [!NOTE]
> **Engineering Handover Package:** The complete final engineering audit, verified test metrics, deployment guides, user manuals, and regulatory evidence are documented in [`docs/handover/FINAL_ENGINEERING_HANDOVER.md`](file:///c:/wamp64/www/afya-poa/docs/handover/FINAL_ENGINEERING_HANDOVER.md).

---

## 1. Regulatory & Architecture Overview

* **Multi-Tenancy:** Hard database engine-level isolation via PostgreSQL **Row-Level Security (RLS)** (`SET LOCAL app.current_tenant_id`).
* **National HIE Alignment:** HL7® FHIR® R4 compliant models aligned with Kenya Core Implementation Guides (`fhir.dha.go.ke/core`).
* **Payer Integration:** Native adapters for **Social Health Authority (SHA)** eClaims (PHC, SHIF, and 24-hour ECCIF emergency submission limits).
* **Fiscal Compliance:** Automated electronic tax invoice signing via **KRA eTIMS** (Tax Procedures Act Section 23A).
* **Data Sovereignty:** Strict compliance with **Regulation 26(2) of the Data Protection (General) Regulations, 2021** (hosting in sovereign Kenyan Tier-3 enterprise data centers).

---

## 2. Monorepo Structure

```
afya-poa/
├── .github/workflows/ci.yml    # Continuous Integration pipeline
├── apps/
│   ├── web/                    # Next.js 15 PWA frontend (React 19, Tailwind CSS)
│   ├── api/                    # NestJS 10 modular monolith REST API
│   ├── worker/                 # Dedicated BullMQ background queue worker process
│   └── mock-server/            # In-memory DHA HIE & SHA Claims synthetic simulator
├── packages/
│   ├── config/                 # Zod-validated environment configurations
│   ├── database/               # PostgreSQL schema (Drizzle ORM), RLS policies, migrations, seeds
│   ├── domain-core/            # Core primitives, Result monad, error classes, tenant context
│   ├── fhir-models/            # Kenya Core FHIR R4 profile typings and interfaces
│   ├── integration-adapters/   # Hexagonal ports-and-adapters for DHA, SHA, KRA, M-Pesa
│   ├── logger/                 # Structured logging module with Pino
│   └── ui/                     # Shared Tailwind / shadcn UI component library
├── infra/
│   ├── docker/                 # Local dev Docker Compose (Postgres 16, Redis 7)
│   └── terraform/              # Infrastructure-as-code for Kenyan cloud deployment
├── docs/                       # Complete regulatory research, PRD, acceptance criteria, and architecture
├── .env.example                # Safe environment variable template
├── pnpm-workspace.yaml         # pnpm workspace definition
└── turbo.json                  # Turborepo task pipeline
```

---

## 3. Quick Start & Prerequisites

### Prerequisites
* **Node.js:** `v20.x` or `v24.x`
* **pnpm:** `v9.x` or `v10.x` (`npm install -g pnpm`)
* **Docker & Docker Compose:** Docker Desktop or Docker Engine v24+

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/comkeycreativelimited/afyapoa.co.ke.git
cd afya-poa
pnpm install
```

### Step 2: Environment Configuration
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

### Step 3: Start Local Infrastructure (Postgres & Redis)
```bash
# Start PostgreSQL 16 and Redis 7 in the background
pnpm docker:up

# Verify containers are healthy
docker ps
```

### Step 4: Run Database Migrations & Synthetic Seed Data
```bash
# Run database migrations (creates tables and RLS policies)
pnpm db:migrate

# Seed synthetic Kenyan demonstration facilities and staff (no real patient data)
pnpm db:seed
```

### Step 5: Start the Platform (All Applications)
```bash
pnpm dev
```

Once running, the following endpoints are available:
* **Frontend Web Application:** [http://localhost:3000](http://localhost:3000)
* **Backend REST API:** [http://localhost:4000](http://localhost:4000)
* **OpenAPI (Swagger) Documentation:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
* **API Health & Readiness Check:** [http://localhost:4000/health/readiness](http://localhost:4000/health/readiness)
* **DHA / SHA Synthetic Mock Simulator:** [http://localhost:4010](http://localhost:4010)

---

## 4. Independent App Execution & Verification

Each application and package can be built, tested, and run independently:

```bash
# Run tests across the monorepo
pnpm test

# Typecheck across the entire monorepo
pnpm typecheck

# Build all applications and packages
pnpm build

# Run specific apps in isolation
pnpm --filter @afyapoa/api dev
pnpm --filter @afyapoa/web dev
pnpm --filter @afyapoa/worker dev
pnpm --filter @afyapoa/mock-server dev
```

---

## 5. Demonstration Facilities (Synthetic Seed Data)

The synthetic seed script initializes three demonstration healthcare facilities:
1. **Nairobi Metropolitan Referral Hospital (Level 5):** KMFL `FID-01-000101-1`, SHA Contract `SHA-CTR-00101`
2. **Afya Poa Community Health Centre Kibera (Level 3):** KMFL `FID-01-000202-2`, SHA Contract `SHA-CTR-00202`
3. **St. Jude Faith Dispensary Machakos (Level 2):** KMFL `FID-02-000303-3`, SHA Contract `SHA-CTR-00303`

> [!NOTE]
> All seed records are 100% synthetic and contain zero real patient personal health information (PHI) or real staff identities.

---

## 6. Troubleshooting

### Port Conflicts (5432 or 6379 already in use)
If you have local instances of PostgreSQL or WAMP/XAMPP or Redis running on ports 5432 or 6379:
1. Stop the local host service, or
2. Change `DATABASE_PORT=5433` and `REDIS_PORT=6380` in `.env` and `infra/docker/docker-compose.yml`.

### Docker Container Health
To view container logs:
```bash
pnpm docker:logs
```

To stop containers:
```bash
pnpm docker:down
```
