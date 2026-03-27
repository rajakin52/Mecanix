# MECANIX — Angola AGT Electronic Invoicing & SAF-T Compliance

> Specification for full compliance with Angola's AGT electronic invoicing mandate and SAF-T (AO) requirements.
>
> **Status:** Planned
> **Created:** 2026-03-27
> **Legal basis:** Presidential Decree No. 71/25, Executive Decree No. 683/25, Executive Decree 74/19

---

## Table of Contents

1. [Regulatory Overview](#1-regulatory-overview)
2. [Current State in MECANIX](#2-current-state-in-mecanix)
3. [What Needs to Be Built](#3-what-needs-to-be-built)
4. [Document Types & Series](#4-document-types--series)
5. [Invoice Hash Chain (Digital Signature)](#5-invoice-hash-chain-digital-signature)
6. [AGT GTA Portal REST API Integration](#6-agt-gta-portal-rest-api-integration)
7. [SAF-T (AO) XML Export](#7-saf-t-ao-xml-export)
8. [Data Model Changes](#8-data-model-changes)
9. [API Endpoints](#9-api-endpoints)
10. [Frontend Changes](#10-frontend-changes)
11. [Contingency Mode](#11-contingency-mode)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Regulatory Overview

### Timeline

| Phase | Date | Who | Requirement |
|-------|------|-----|-------------|
| **Phase 1** | 1 January 2026 | Large taxpayers, government suppliers, invoices >= 25M AOA | Mandatory e-invoicing |
| **Phase 2** | 2026-2027 | All VAT-registered (General + Simplified regimes) | Full rollout |
| **SAF-T Annual** | 10 April each year | All taxpayers | Submit SAF-T (AO) XML for previous fiscal year |

### Key Requirements

1. **AGT-Certified Software** — billing software must be certified by AGT
2. **Hash Chain** — each document must have a unique digital signature hash linking to the previous document
3. **Document Numbering** — sequential, per series, no gaps
4. **Real-Time Submission** — invoices submitted to AGT via GTA REST API in JSON format
5. **AGT Validation Code** — AGT returns a unique code per invoice, required for VAT deductibility
6. **SAF-T (AO) Export** — annual XML file following the SAF-T AO schema (urn:OECD:StandardAuditFile-Tax:AO_1.01_01)
7. **Contingency Mode** — must support offline issuance when AGT portal is unavailable
8. **Audit Trail** — all modifications must be traceable, no deletion of issued documents

### Four Pillars of AGT Validation

1. Compliance with rules for physical/electronic documents
2. Application controls (user authentication, modification tracking)
3. Unique hash code per document (prevents tampering)
4. SAF-T (AO) file generation capability

---

## 2. Current State in MECANIX

### What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Invoice generation | Built | `invoices.service.ts` generates from job cards |
| Invoice numbering | Built | `generate_invoice_number()` RPC, sequential |
| Credit notes | Built | `credit-notes.controller.ts` |
| Payments | Built | `payments.controller.ts` |
| SAF-T XML export | Partial | `saft-export.provider.ts` — basic XML, needs AGT schema compliance |
| Primavera integration | Built | For customers using Primavera V10 |
| ERP export log | Built | `erp_export_log` table tracks all exports |
| Tax rate | Built | Configurable per tenant (default 14%) |
| Invoice print/PDF | Built | `/print/invoice/[id]` page |

### What's Missing

| Component | Status |
|-----------|--------|
| Hash chain (digital signature per document) | Not built |
| AGT GTA REST API integration | Not built |
| AGT validation code storage | Not built |
| Document series management | Not built |
| SAF-T (AO) compliant XML (full schema) | Partial — needs update |
| Contingency mode | Not built |
| AGT certificates (public/private key) | Not configured |
| AGT software certification number | Not configured |
| QR code on invoices (with hash) | Not built |
| Annual SAF-T submission workflow | Not built |

---

## 3. What Needs to Be Built

### 3.1 Document Hash Chain

Every invoice, credit note, and receipt must include a cryptographic hash (SHA-1 or SHA-256) of key document data, chained to the previous document in the series. This prevents retroactive modification.

**Hash input string:**
```
InvoiceDate;SystemEntryDate;InvoiceNumber;GrossTotal;PreviousHash
```

**Process:**
1. For the first document in a series, `PreviousHash` = empty string
2. Hash = RSA-SHA1(input_string, private_key)
3. Store the full hash and the first 4 characters as the short hash (displayed on the document)
4. The hash is included in the printed invoice and in the SAF-T export

### 3.2 Document Series

Each document type needs at least one series:

| Type | Code | Example Number |
|------|------|---------------|
| Invoice | FT | FT MECANIX/1 |
| Simplified Invoice | FS | FS MECANIX/1 |
| Credit Note | NC | NC MECANIX/1 |
| Debit Note | ND | ND MECANIX/1 |
| Receipt | RE | RE MECANIX/1 |
| Invoice-Receipt | FR | FR MECANIX/1 |

Format: `{DocType} {SeriesCode}/{SequentialNumber}`

### 3.3 AGT GTA REST API

7 REST API services for integration with SIGT:

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Submit Invoice** | Send invoice JSON to AGT, receive validation code |
| 2 | **Submit Credit Note** | Send credit note |
| 3 | **Submit Receipt** | Send receipt/payment |
| 4 | **Submit Invoice-Receipt** | Send combined doc |
| 5 | **Cancel Document** | Request document cancellation |
| 6 | **Query Status** | Check document validation status |
| 7 | **Get Validation Code** | Retrieve AGT code for a document |

**Authentication:** X.509 certificate (public + private key pair issued by AGT)

**Flow:**
```
1. MECANIX creates invoice with hash
2. POST invoice JSON to AGT GTA endpoint
3. AGT validates and returns:
   - Validation code (ATCUD equivalent for Angola)
   - Status (valid/invalid)
   - Error details if invalid
4. Store AGT validation code on the invoice
5. Include code in printed/PDF invoice
6. If AGT is unavailable → contingency mode
```

### 3.4 SAF-T (AO) XML

Annual file following the official XSD schema (`SAFTAO1.01_01.xsd`):

**Sections:**
1. **Header** — company info, fiscal year, software certification number
2. **MasterFiles** — customers, products, tax table
3. **SourceDocuments**
   - **SalesInvoices** — all FT, FS, NC, ND documents
   - **Payments** — all RE documents
   - **MovementOfGoods** — stock movements (if applicable)

**Key fields per invoice:**
- `Hash` — the document hash
- `HashControl` — hash version identifier
- `InvoiceDate`, `SystemEntryDate`
- `InvoiceNo` — full document number (e.g. "FT MECANIX/1")
- `DocumentStatus` — N (normal), A (cancelled), F (invoiced)
- `CustomerID`, `CustomerTaxID`
- `Line` items with `ProductCode`, `Quantity`, `UnitPrice`, `TaxType`, `TaxCode`, `TaxPercentage`
- `DocumentTotals` — `TaxPayable`, `NetTotal`, `GrossTotal`

---

## 4. Document Types & Series

### Configuration

Each tenant configures:
- Software certification number (from AGT)
- AGT certificate files (public + private key)
- Active document series per type
- Default IVA rate (14%)
- Company tax ID (NIF)
- Business establishment code

### Series Management

Series are created per document type and can have:
- `code` — e.g. "MECANIX", "SEDE", "FILIAL1"
- `current_number` — last used sequential number
- `is_active` — only one active series per type at a time
- `year` — fiscal year

---

## 5. Invoice Hash Chain (Digital Signature)

### Implementation

```typescript
// Pseudo-code for hash generation
function generateDocumentHash(
  invoiceDate: string,       // YYYY-MM-DD
  systemEntryDate: string,   // YYYY-MM-DDTHH:mm:ss
  documentNumber: string,    // "FT MECANIX/1"
  grossTotal: number,        // e.g. 26700.00
  previousHash: string,      // hash of previous doc in series (empty for first)
  privateKey: string,        // AGT-issued RSA private key
): string {
  const plainText = `${invoiceDate};${systemEntryDate};${documentNumber};${grossTotal.toFixed(2)};${previousHash}`;
  const signature = rsaSign(plainText, privateKey, 'SHA1');
  return base64Encode(signature);
}
```

### Storage

Each invoice stores:
- `hash` — full Base64-encoded hash
- `hash_control` — version identifier (e.g. "1")
- `short_hash` — first 4 chars (displayed on document)
- `agt_validation_code` — code returned by AGT after submission
- `agt_submission_status` — 'pending', 'submitted', 'validated', 'rejected', 'contingency'
- `agt_submitted_at` — timestamp of submission
- `agt_response` — full AGT response JSON (for audit)

---

## 6. AGT GTA Portal REST API Integration

### Configuration (per tenant)

```
agt_environment: 'sandbox' | 'production'
agt_base_url: 'https://gta.minfin.gov.ao/api/v1' (production)
agt_certificate_path: path to .pfx or .pem
agt_certificate_password: encrypted password
agt_software_cert_number: 'XXXX' (from AGT certification)
agt_taxpayer_nif: tenant's NIF
```

### Submission Flow

```
Invoice Created in MECANIX
  ↓
Generate Hash (with private key)
  ↓
Build JSON payload per AGT schema
  ↓
POST to AGT GTA endpoint
  ↓
Receive response
  ├─ Success → Store validation code, status = 'validated'
  ├─ Invalid → Store errors, status = 'rejected', alert user
  └─ Timeout/Error → Contingency mode, status = 'contingency'
  ↓
Include validation code + hash on printed invoice
```

### Auto-Submission

Invoices are submitted to AGT automatically when:
- Invoice status changes to 'sent' or 'paid'
- Or configurable: submit immediately on creation

Background retry for failed submissions (exponential backoff, max 24h).

---

## 7. SAF-T (AO) XML Export

### Enhancement of Existing Provider

The current `saft-export.provider.ts` needs to be upgraded to:
- Follow the official XSD schema (`SAFTAO1.01_01.xsd`)
- Include all required header fields (software cert number, company NIF, fiscal year)
- Include proper hash values per document
- Include customer master data with NIF
- Include product/service master data
- Support date range filtering
- Generate valid XML that passes AGT validation tools

### Annual Export Workflow

1. Admin goes to Settings → AGT → SAF-T Export
2. Selects fiscal year
3. System generates full SAF-T (AO) XML
4. Downloads file for submission to AGT by April 10

---

## 8. Data Model Changes

### New table: `document_series`

```sql
CREATE TABLE public.document_series (
  id              uuid PK,
  tenant_id       uuid FK -> tenants,
  document_type   text NOT NULL CHECK (document_type IN ('FT', 'FS', 'NC', 'ND', 'RE', 'FR')),
  series_code     text NOT NULL,
  current_number  integer NOT NULL DEFAULT 0,
  fiscal_year     integer NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_series_unique ON document_series(tenant_id, document_type, series_code, fiscal_year);
```

### Alter `invoices` table

```sql
ALTER TABLE public.invoices
  ADD COLUMN document_type text DEFAULT 'FT',
  ADD COLUMN series_id uuid REFERENCES document_series(id),
  ADD COLUMN saft_document_number text,  -- "FT MECANIX/1"
  ADD COLUMN hash text,
  ADD COLUMN hash_control text DEFAULT '1',
  ADD COLUMN short_hash text,
  ADD COLUMN agt_validation_code text,
  ADD COLUMN agt_submission_status text DEFAULT 'pending'
    CHECK (agt_submission_status IN ('pending', 'submitted', 'validated', 'rejected', 'contingency')),
  ADD COLUMN agt_submitted_at timestamptz,
  ADD COLUMN agt_response jsonb,
  ADD COLUMN system_entry_date timestamptz DEFAULT NOW();
```

### Alter `credit_notes` table (same hash fields)

```sql
ALTER TABLE public.credit_notes
  ADD COLUMN series_id uuid REFERENCES document_series(id),
  ADD COLUMN saft_document_number text,
  ADD COLUMN hash text,
  ADD COLUMN hash_control text DEFAULT '1',
  ADD COLUMN short_hash text,
  ADD COLUMN agt_validation_code text,
  ADD COLUMN agt_submission_status text DEFAULT 'pending',
  ADD COLUMN agt_submitted_at timestamptz,
  ADD COLUMN agt_response jsonb;
```

### New table: `agt_config` (per tenant)

```sql
CREATE TABLE public.agt_config (
  id              uuid PK,
  tenant_id       uuid FK -> tenants UNIQUE,
  environment     text DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  software_cert_number text,
  taxpayer_nif    text,
  certificate_public_key text,
  certificate_private_key text,  -- encrypted
  auto_submit     boolean DEFAULT true,
  created_at      timestamptz DEFAULT NOW(),
  updated_at      timestamptz DEFAULT NOW()
);
```

---

## 9. API Endpoints

### AGT Configuration

| Method | Path | Description |
|--------|------|-------------|
| GET | `/agt/config` | Get AGT configuration |
| PUT | `/agt/config` | Update AGT config (keys, NIF, etc.) |
| POST | `/agt/test-connection` | Test AGT API connectivity |

### Document Series

| Method | Path | Description |
|--------|------|-------------|
| GET | `/agt/series` | List all document series |
| POST | `/agt/series` | Create new series |
| PATCH | `/agt/series/:id` | Update series (activate/deactivate) |

### AGT Submission

| Method | Path | Description |
|--------|------|-------------|
| POST | `/agt/submit/:invoiceId` | Submit invoice to AGT |
| POST | `/agt/submit-batch` | Submit multiple pending invoices |
| GET | `/agt/status/:invoiceId` | Check AGT status for an invoice |
| POST | `/agt/retry/:invoiceId` | Retry failed submission |

### SAF-T Export

| Method | Path | Description |
|--------|------|-------------|
| POST | `/agt/saft-export` | Generate SAF-T (AO) XML for a period |
| GET | `/agt/saft-export/:exportId` | Download generated file |

---

## 10. Frontend Changes

### Settings → AGT Configuration Page

- **Connection Settings**: environment (sandbox/production), software cert number, NIF
- **Certificate Upload**: upload public + private key files
- **Test Connection**: button to verify AGT API access
- **Auto-Submit Toggle**: submit invoices automatically or manually

### Settings → Document Series

- List active series per document type
- Create new series for new fiscal year
- Activate/deactivate series

### Invoice Detail — AGT Status

- Show AGT submission status badge (pending/submitted/validated/rejected/contingency)
- Show validation code when available
- Show hash short code
- Retry button for failed submissions
- View AGT response details

### Invoice Print — AGT Fields

- Add hash short code to printed invoice
- Add AGT validation code (when available)
- Add QR code containing: NIF, document number, date, gross total, hash
- Add software certification number in footer

### Reports → SAF-T Export

- Select fiscal year/period
- Generate and download SAF-T (AO) XML
- Show export history

---

## 11. Contingency Mode

When AGT GTA portal is unavailable:

1. Invoice is created normally with hash
2. AGT submission fails → status = 'contingency'
3. Invoice is marked with "Contingency" indicator
4. Printed invoice shows "Documento emitido em modo de contingência"
5. Background job retries submission periodically
6. Once AGT is back online, all contingency invoices are submitted in batch
7. Validation codes are updated retroactively

**Legal requirement:** Contingency invoices must be communicated to AGT within 5 business days of the system coming back online.

---

## 12. Implementation Phases

| Phase | Scope | Duration |
|-------|-------|----------|
| **1** | Document series management + hash chain generation | 1 week |
| **2** | Invoice/credit note hash integration + QR code on print | 1 week |
| **3** | AGT GTA REST API integration (submit, status, retry) | 2 weeks |
| **4** | SAF-T (AO) full schema XML export | 1-2 weeks |
| **5** | Contingency mode + auto-retry + batch submission | 1 week |
| **6** | Frontend: AGT config, series management, status display | 1 week |
| **7** | AGT software certification process | External (AGT timeline) |

**Total estimated effort: 7-9 weeks**

**Note:** Phase 7 (AGT certification) depends on AGT's process and timeline. The technical implementation (Phases 1-6) can proceed in parallel with the certification application.

---

## Technical Addendum — Detailed Specifications

### A. Hash Computation (per Decreto Executivo 74/19)

The hash is computed per the RSA algorithm as defined in Decreto Executivo 74/19. The input is a concatenation of document fields separated by semicolons.

**Hash input string for invoices (SalesInvoices):**

```
{InvoiceDate};{SystemEntryDate};{InvoiceNo};{GrossTotal};{Hash of previous document in same series}
```

**Example:**

```
First invoice in series:
  InvoiceDate = 2026-03-27
  SystemEntryDate = 2026-03-27T14:30:00
  InvoiceNo = FT MECANIX/1
  GrossTotal = 26700.00
  PreviousHash = (empty for first document)

  Input: "2026-03-27;2026-03-27T14:30:00;FT MECANIX/1;26700.00;"
  Hash = RSA_Sign(SHA-1(input), private_key)
  Base64Hash = Base64Encode(Hash)

Second invoice:
  PreviousHash = Base64Hash of first invoice
  Input: "2026-03-28;2026-03-28T09:15:00;FT MECANIX/2;15000.00;{Base64Hash of FT MECANIX/1}"
```

**Hash for credit notes (same logic):**
```
{InvoiceDate};{SystemEntryDate};{DocumentNumber};{GrossTotal};{PreviousHash}
```

**Hash for payments/receipts:**
```
{TransactionDate};{SystemEntryDate};{PaymentRefNo};{GrossTotal};{PreviousHash}
```

**Key rules:**
- `GrossTotal` formatted with 2 decimal places (e.g. "26700.00")
- `SystemEntryDate` in ISO 8601 format with time (YYYY-MM-DDTHH:mm:ss)
- For first document in a series, `PreviousHash` = empty string (but the trailing semicolon is still present)
- RSA key size: 1024-bit minimum (2048-bit recommended)
- Private key obtained from AGT as PSE/PFX/PEM file
- `HashControl` field = "1" (version identifier, may change if algorithm changes)
- `Hash` in SAF-T = full Base64-encoded RSA-SHA1 signature
- Short hash (4 chars) displayed on printed document = first 4 characters of the Base64 hash

### B. Document Number Format

Per SAF-T AO specification, document numbers follow this pattern:

```
{SpaceType} {InternalCode}/{SequentialNumber}
```

Where:
- `SpaceType` = document type code (FT, FS, NC, ND, RE, FR)
- `InternalCode` = series code assigned by the application (e.g. "MECANIX", "SEDE")
- `SequentialNumber` = sequential number within the series, no gaps

**Examples:**
```
FT MECANIX/1      (Invoice #1)
FT MECANIX/2      (Invoice #2)
NC MECANIX/1      (Credit Note #1)
RE MECANIX/1      (Receipt #1)
FR MECANIX/1      (Invoice-Receipt #1)
```

**Rules:**
- Numbers must be sequential with NO GAPS
- Each document type has its own independent sequence
- Series reset per fiscal year (optional but common)
- Cancelled documents retain their number (status = "A" in SAF-T)

### C. QR Code Content

Each printed invoice must include a QR code containing:

```
A:{NIF_Emitente}*B:{NIF_Cliente}*C:{Pais_Cliente}*D:{TipoDocumento}*
E:{StatusDocumento}*F:{DataDocumento}*G:{NumeroDocumento}*
H:{ATCUD_or_ValidationCode}*I1:{EspacoFiscal}*
I7:{TotalBrutoIVA14}*I8:{TotalIVA14}*
N:{TotalImpostos}*O:{TotalBruto}*Q:{Hash4Chars}*R:{NumeroCertificado}
```

**Field mapping for MECANIX:**

| QR Field | SAF-T Field | Example |
|----------|-------------|---------|
| A | CompanyID (NIF) | 5417654321 |
| B | Customer TaxID | 5412345678 |
| C | Customer Country | AO |
| D | Document Type | FT |
| E | Document Status | N (normal) |
| F | Invoice Date | 20260327 |
| G | Invoice Number | FT MECANIX/1 |
| H | AGT Validation Code | AGT-XXX-XXXX |
| I1 | Tax Country | AO |
| I7 | Taxable Base (14%) | 23421.05 |
| I8 | Tax Amount (14%) | 3278.95 |
| N | Total Tax | 3278.95 |
| O | Gross Total | 26700.00 |
| Q | Hash (4 chars) | Ab3F |
| R | Software Cert # | 1234 |

### D. AGT GTA API — JSON Payload Structure

Based on the SAF-T schema and AGT requirements, the JSON payload for invoice submission:

```json
{
  "tipoDocumento": "FT",
  "serie": "MECANIX",
  "numero": 1,
  "dataDocumento": "2026-03-27",
  "dataSystema": "2026-03-27T14:30:00",
  "estado": "N",
  "hash": "base64_encoded_hash...",
  "hashControl": "1",
  "emitente": {
    "nif": "5417654321",
    "nome": "Oficina Demo Lda",
    "endereco": {
      "rua": "Rua da Missão, 123",
      "cidade": "Luanda",
      "codigoPostal": "",
      "pais": "AO"
    }
  },
  "cliente": {
    "nif": "5412345678",
    "nome": "António Fernandes",
    "endereco": {
      "rua": "...",
      "cidade": "Luanda",
      "pais": "AO"
    }
  },
  "linhas": [
    {
      "numeroLinha": 1,
      "codigoProduto": "SRV-BRAKE",
      "descricao": "Brake Pad Replacement",
      "quantidade": 1,
      "unidadeMedida": "UN",
      "precoUnitario": 15000.00,
      "valorDesconto": 0,
      "imposto": {
        "tipoImposto": "IVA",
        "codigoImposto": "NOR",
        "pais": "AO",
        "percentagem": 14.00,
        "montanteImposto": 2100.00
      },
      "montanteCredito": 15000.00
    }
  ],
  "totais": {
    "impostoDevido": 3278.95,
    "totalLiquido": 23421.05,
    "totalBruto": 26700.00
  }
}
```

**Note:** The exact JSON schema may differ from the above — AGT provides the definitive schema upon partner registration. The above is based on the SAF-T AO XSD structure translated to JSON.

### E. SAF-T (AO) XML Structure

Full XML structure per XSD `SAFTAO1.01_01.xsd`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>{NIF}</CompanyID>
    <TaxRegistrationNumber>{NIF}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>{Workshop Name}</CompanyName>
    <CompanyAddress>
      <AddressDetail>{Address}</AddressDetail>
      <City>{City}</City>
      <PostalCode></PostalCode>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>{YYYY}</FiscalYear>
    <DateCreated>{YYYY-MM-DD}</DateCreated>
    <StartDate>{YYYY-01-01}</StartDate>
    <EndDate>{YYYY-12-31}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <SoftwareCertificateNumber>{CertNumber}</SoftwareCertificateNumber>
    <ProductCompanyTaxID>{MECANIX NIF}</ProductCompanyTaxID>
    <ProductID>MECANIX/MECANIX</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>

  <MasterFiles>
    <Customer>
      <CustomerID>{id}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>{NIF or 999999999}</CustomerTaxID>
      <CompanyName>{Name}</CompanyName>
      <BillingAddress>...</BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>

    <Product>
      <ProductType>S</ProductType>
      <ProductCode>{code}</ProductCode>
      <ProductDescription>{description}</ProductDescription>
      <ProductNumberCode>{code}</ProductNumberCode>
    </Product>

    <TaxTable>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>IVA 14%</Description>
        <TaxPercentage>14.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>ISE</TaxCode>
        <Description>Isento</Description>
        <TaxPercentage>0.00</TaxPercentage>
      </TaxTableEntry>
    </TaxTable>
  </MasterFiles>

  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>{count}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>{sum of all invoices}</TotalCredit>

      <Invoice>
        <InvoiceNo>FT MECANIX/1</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>{date}</InvoiceStatusDate>
          <SourceID>{user}</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>{full base64 hash}</Hash>
        <HashControl>1</HashControl>
        <InvoiceDate>2026-03-27</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>{user who created}</SourceID>
        <SystemEntryDate>2026-03-27T14:30:00</SystemEntryDate>
        <CustomerID>{id}</CustomerID>

        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>SRV-BRAKE</ProductCode>
          <ProductDescription>Brake Pad Replacement</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>15000.00</UnitPrice>
          <CreditAmount>15000.00</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>14.00</TaxPercentage>
          </Tax>
        </Line>

        <DocumentTotals>
          <TaxPayable>3278.95</TaxPayable>
          <NetTotal>23421.05</NetTotal>
          <GrossTotal>26700.00</GrossTotal>
        </DocumentTotals>
      </Invoice>
    </SalesInvoices>

    <Payments>
      <NumberOfEntries>{count}</NumberOfEntries>
      <TotalDebit>{sum}</TotalDebit>
      <TotalCredit>0.00</TotalCredit>

      <Payment>
        <PaymentRefNo>RE MECANIX/1</PaymentRefNo>
        <TransactionDate>2026-03-27</TransactionDate>
        <PaymentType>RG</PaymentType>
        <DocumentStatus>...</DocumentStatus>
        <Hash>{hash}</Hash>
        <HashControl>1</HashControl>
        <SystemEntryDate>2026-03-27T15:00:00</SystemEntryDate>
        <CustomerID>{id}</CustomerID>
        <Line>...</Line>
        <DocumentTotals>...</DocumentTotals>
      </Payment>
    </Payments>
  </SourceDocuments>
</AuditFile>
```

### F. Penalties for Non-Compliance

| Violation | Penalty |
|-----------|---------|
| Failure to issue electronic invoices | 100,000 - 10,000,000 AOA |
| Using non-certified software | 200,000 - 20,000,000 AOA |
| Failure to submit SAF-T by April 10 | 50,000 - 5,000,000 AOA |
| Missing or invalid hash on documents | Software decertification risk |
| Gap in document numbering sequence | Audit trigger + penalties |

### G. AGT Software Certification Process

1. **Apply** — submit application to AGT with software details
2. **Technical Review** — AGT tests the software for:
   - Correct hash generation (RSA-SHA1)
   - Sequential numbering without gaps
   - SAF-T (AO) XML generation and validation
   - JSON submission to GTA API
   - Contingency mode handling
   - Audit trail integrity
3. **Testing** — run test scenarios in AGT sandbox environment
4. **Certification** — receive software certification number
5. **Production** — connect to production GTA API

**Timeline:** 4-8 weeks from application (depends on AGT queue)

### H. Key Open Questions (To Resolve with AGT)

1. **GTA API exact endpoint URLs** — sandbox and production base URLs
2. **Authentication method** — X.509 mutual TLS or OAuth2 with client certificates?
3. **Rate limits** — max requests per minute/hour
4. **Retry policy** — AGT's recommended retry intervals for failed submissions
5. **Contingency window** — exact number of business days for retroactive submission
6. **SAF-T submission** — via Portal do Contribuinte upload or API?
7. **Multi-tenant** — can one software certification cover multiple workshops (tenants)?

**Action:** Contact AGT Partner Support at apoio.agt@minfin.gov.ao or (+244) 923 16 70 10 to request:
- GTA API technical documentation package
- Sandbox environment access
- Software certification application form

---

## References

- [Angola AGT e-invoicing mandate (EDICOM)](https://edicomgroup.com/blog/angola-mandated-electronic-invoicing)
- [E-Invoicing in Angola: AGT Rules & Compliance Guide (Flick)](https://www.flick.network/en-ao/e-invoicing-in-angola)
- [Angola e-invoicing phased implementation (VATabout)](https://vatabout.com/angolas-e-invoicing-mandate-phased-implementation-continues-into-2026)
- [SAF-T AO Official XSD Schema (GitHub)](https://github.com/assoft-portugal/SAF-T-AO)
- [SAF-T AO XSD v1.01_01](https://github.com/assoft-portugal/SAF-T-AO/blob/master/XSD/SAFTAO1.01_01.xsd)
- [EY Angola — E-invoicing from 1 January 2026](https://www.ey.com/pt_ao/technical/tax-alerts/facturacao-electronica-a-partir-de-1-de-janeiro-de-2026)
- [PwC Angola — IVA & Invoice Legal Regime](https://www.pwc.com/ao/pt/servicos/tax/iva-regime-juridico-das-facturas.html)
- [SAP Document Reporting Compliance Angola](https://community.sap.com/t5/technology-blog-posts-by-members/be-electronic-invoicing-compliant-in-angola-with-sap-document-reporting/ba-p/14232809)
- [Angola AGT Portal do Contribuinte](https://portaldocontribuinte.minfin.gov.ao)
- [SAP SAF-T Digital Signature for Angola (Product Documentation)](https://www.vatupdate.com/wp-content/uploads/2021/01/SAF-TDigitalSignatureForAngola_ProductDocumentation_V_23.10.2020.pdf)
- [SAP Document Reporting Compliance Angola (User Guide 2025)](https://help.sap.com/doc/372377023b164eb3b572abfc727cc22c/1.0/en-US/24ae78dd98eb40478a27cf54c4686d26.pdf)
- [SAF-T AO Hash Validation Issues (GitHub)](https://github.com/assoft-portugal/SAF-T-AO/issues/49)
- [KPMG — Angola mandatory e-invoicing](https://kpmg.com/us/en/taxnewsflash/news/2025/10/angola-legislation-mandatory-e-invoicing-october-1-2025.html)
- [Cegid — Facturação Electrónica Angola](https://www.cegid.com/ao/o-que-e-a-facturacao-electronica/)
- [Primavera — Software Certificado pela AGT](https://ao.primaverabss.com/pt/comunicados-de-imprensa/software-primavera-certificado-pela-agt/)
- [AGT Facturação Electrónica Portal](https://quiosqueagt.minfin.gov.ao/facturacao-eletronica)
- [VATupdate — E-Invoicing Penalty Relief (March 2026)](https://www.vatupdate.com/2026/03/14/e-invoicing-penalty-relief-for-resolving-implementation-challenges/)
