# Module 20 — Assessment Platform as a Service (APAAS)

> **Status:** Strategic plan drafted 2026-04-21. Entry point (claim packet + email submission) ships alongside; full APAAS is a multi-quarter product.
> **Theme:** Today MECANIX sells software to workshops. APAAS is a second product line that sells an **independent claim-assessment platform** to **insurance companies** — in the space currently dominated by Audatex, Mitchell, CCC, GT Motive. The wedge is that MECANIX already has the workshop-side data (DVI + parts + labour + photos) and can assemble an assessment *from the repair side* instead of from a desk adjuster.
> **Market:** Lusophone-first (AO, PT, MZ, BR). Arguably every Portuguese / African insurer today runs on Excel + phone calls; the incumbents skipped these markets.

---

## 1. Competitive context

| Vendor | Strength | Weakness in Lusophone market |
|---|---|---|
| Audatex / Solera | De-facto global standard, OEM repair-time data, VIN→parts | Expensive, Portuguese/African market poorly served, contracts don't flex for small insurers |
| Mitchell International | US-centric, strong claim-to-estimate workflow | Not localized, no LATAM footprint beyond BR |
| CCC Intelligent Solutions | AI-driven photo damage detection, big US insurer footprint | US-only essentially |
| GT Motive | European alternative to Audatex, cheaper | Limited AO / MZ coverage, Portuguese localization shallow |

**MECANIX wedge:**
- Already in the shops generating damage data — bottom-up network effect.
- Photo + DVI + estimate + parts catalogue already structured.
- Claude-vision integration (added Phase 4 item 2) can flag damage from photos without licensing an OEM database.
- Per-tenant data stays tenant-owned; insurer-side view is a read-only overlay.

## 2. Product surface (3-sided)

```
                ┌─────────────────────┐
                │  Assessment engine  │
                │  (MECANIX-owned)    │
                └──────────┬──────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐   ┌────────────┐  ┌────────────┐
    │  Workshops │   │   Adjuster │  │  Customer  │
    │ (existing) │   │   portal   │  │ (existing) │
    └────────────┘   └────────────┘  └────────────┘
```

1. **Workshops** — already logged in. Their DVI + photos + estimate feed the assessment as-is.
2. **Adjuster portal** — new app for insurance company staff. Review, supplement, approve/reject line-by-line. Already partially modelled in module 7.
3. **Customer** — already covered by the existing customer portal.

## 3. Feature backlog (ranked by revenue leverage)

### Tier A — MVP of APAAS (Q2–Q3)

| # | Feature | Why |
|---|---|---|
| 1 | **Claim packet PDF + email submission** (Phase 3 item 3 — shipping today) | Foundation; validates the wedge with existing MECANIX workshops. |
| 2 | **Insurer claim inbox** (adjuster portal v1) | Read-only inbox of submissions keyed by insurer login. |
| 3 | **Line-by-line approval workflow** | Adjuster approves / rejects / supplements each estimate line. Module 7 has scaffolding; needs UI. |
| 4 | **Standardized labour-time catalogue** | Repair-time book keyed by operation × vehicle segment. Seed from OEM tables + MECANIX historical median time-per-operation. |
| 5 | **Photo-based damage detection** | Claude-vision extends the receipt OCR pattern: "classify damage per panel from these photos" → bounding-box damage type + severity. |
| 6 | **Parts pricing oracle** | Best-known parts prices per part_number × market, fed by the MECANIX parts ledger. Adjuster sees min/median/max. |

### Tier B — competitive parity (Q3–Q4)

| # | Feature | Why |
|---|---|---|
| 7 | **VIN → parts decode via TecDoc** | Already integrated in the workshop product; expose to adjusters. |
| 8 | **Supplementary estimate flow** | When additional damage is found mid-repair, the supplement follows the same approval ladder. |
| 9 | **Total-loss vs. repair decision support** | If estimated repair > x% of vehicle value, auto-flag for total-loss review. |
| 10 | **Claim history per VIN / per customer** | Fraud signal: same damage on same panel repaired twice. |
| 11 | **Adjuster SLA tracking** | Days-to-approve per insurer, per adjuster. |

### Tier C — strategic moat (year 2+)

| # | Feature | Why |
|---|---|---|
| 12 | **Fraud scoring model** | Trained on the network. Anomalous cost vs. fleet median, duplicate claims, suspicious vendor-customer relationships. |
| 13 | **Network parts marketplace** | Already on the strategic-bets list; APAAS makes it a three-sided network. |
| 14 | **Insurer-branded white-label** | Let an insurer brand the adjuster portal and self-serve configure. |
| 15 | **Audatex / GT Motive import** | Let an insurer paste a legacy estimate; APAAS parses, normalizes, and re-renders in the MECANIX format. One-way bridge for migration. |

## 4. Data model additions (forward-looking)

Tables needed for Tier A (most don't exist yet):

- `claim_packets` — generated submission bundles; `storage_url`, `generated_at`, `submitted_at`, `submission_channel` (`email` / `api`), `recipient`, `status`.
- `insurer_accounts` — per-insurer logins. `insurance_company_id`, `auth_method` (`password`, `sso`), `contact_email`, `submission_email`, `allowed_submission_channels`.
- `repair_time_catalogue` — operation × vehicle_segment → standard minutes. Seed from public OEM tables; override per insurer contract.
- `assessment_findings` — the photo-detected damage entries (bounding box + type + severity + panel) produced by AI vision and reviewed by the adjuster.
- `parts_price_observations` — every time a part is purchased or invoiced, log `part_number`, `unit_cost`, `market`, `observed_at`. Powers the pricing oracle.

Tier B+ adds: `claim_supplements`, `total_loss_threshold_rules`, `vin_claim_history` (materialized view), `fraud_signals`, `sla_targets`.

## 5. Revenue models

- **Per-assessment fee** to the insurer — €2–5 per claim packet submitted.
- **SaaS subscription** for insurer access to the adjuster portal + pricing oracle.
- **Data licensing** — anonymized labour-time benchmarks sold back as a report.
- **Workshop-side upgrade** — "MECANIX Pro" tier unlocked by workshops that generate ≥N claims/month, priced per job.

## 6. Go-to-market

1. Pilot with **one** mid-size insurer in AO or PT. Something like Ensa or Fidelidade Angola — a tier-2 insurer with enough volume to matter but without an Audatex contract to defend.
2. Run the pilot with three MECANIX workshops that already have deep relationships with that insurer.
3. Measure: days from job creation to insurer approval vs. their baseline.
4. Publish the case study. Sell to insurer #2 based on it.

## 7. Risks & open questions

- **Regulatory** — in PT, insurance loss-adjustment is a licensed activity. MECANIX as a platform is fine; MECANIX as an opinion-forming assessor may need licensed third parties on staff. Check ASF (PT) / ARSEG (AO) positions.
- **Legacy contracts** — Audatex locks insurers in multi-year deals. Initial wins likely smaller, regional insurers.
- **Data ownership** — every workshop owns its data. APAAS sells the aggregate; individual shop data never leaves the tenant boundary without explicit consent. Needs a privacy architecture review.
- **Insurer onboarding** — even with the wedge, insurers are slow. Expect 6–12 months for first live customer.
- **Assessment quality** — an adjuster is a regulated opinion-giver. The platform must not pretend to *be* the adjuster; it renders data. The human decides.

## 8. What's actually shippable this session

Only the **Phase 3 item 3 foundation**: claim packet PDF + email submission. Everything else in this module is a forward plan that needs insurer partnership before it's worth building. The foundation:

- Proves the packet structure the insurer will see.
- Captures the submission state machine.
- Gives MECANIX workshops an immediate day-1 time-saver (no more manual typing into an insurer portal).

Shipping that lays the groundwork for Tier A #2 (insurer inbox) when the first pilot partner comes to the table.
