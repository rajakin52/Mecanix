# 7. Insurance Evaluation & Approvals System

> **New Module:** The Insurance module creates a structured digital workflow between workshops and insurance companies for accident repair claims. This replaces the current process of phone calls, faxes, and in-person assessor visits, reducing claim processing from days to hours.

## 7.1 Market Context

In Angola, Mozambique, and Brazil, insurance-funded accident repairs represent 20–40% of workshop revenue. The current process is entirely manual: the workshop calls the insurer, an assessor visits (often days later), handwritten estimates are exchanged, and approval comes via phone. This causes delays averaging 5–7 days before repair work can begin.

MECANIX digitises this entire workflow, creating value for all parties:

- **Workshops:** Faster approvals mean shorter vehicle dwell time, faster payment, and higher throughput
- **Insurance companies:** Lower processing costs, fraud reduction through photo evidence, real-time repair tracking, and structured data for analytics
- **Customers:** Transparent claim status, shorter wait times, and digital communication throughout

## 7.2 Workflow Overview

| Stage | Actor | Actions | System Behaviour |
|-------|-------|---------|-----------------|
| 1. Claim Initiation | Workshop / Receptionist | Create job card, mark as insurance job, enter policy number and insurer | Auto-notify insurer via API; create claim record |
| 2. Damage Documentation | Technician | Photograph damage (min 4 photos), record diagnosis, create initial estimate | Photos tagged to claim; estimate structured as labour + parts lines |
| 3. Estimate Submission | Service Manager | Review and submit estimate to insurer with supporting photos | Digital submission via portal API; insurer receives notification |
| 4. Assessment | Insurance Assessor | Review estimate, compare to market rates, request adjustments if needed | In-portal review; negotiation thread preserved |
| 5. Approval / Rejection | Insurance Assessor | Approve estimate (full or partial), reject with reasons, or request re-inspection | Approval triggers job card status to In Progress; rejection notifies workshop |
| 6. Repair & Monitoring | Technician / Assessor | Technician works on repair; assessor can monitor progress and photos remotely | Real-time status updates; milestone photos required at configurable stages |
| 7. Completion & Payment | Workshop / Insurer | Workshop marks complete; insurer reviews final photos; payment authorised | Invoice split: insurer portion + customer excess; payment tracked separately |

## 7.3 Workshop-Side Features

### 7.3.1 Insurance Job Card Enhancements
- Toggle on job card: "Insurance Claim" — unlocks insurance-specific fields
- Insurance fields: policy number, insurer (dropdown of registered insurers), claim reference, excess amount
- Mandatory damage photo set: front, rear, left, right, close-up of damage (minimum 4, configurable)
- Structured estimate with line-by-line breakdown (required for insurer review)
- Estimate comparison: workshop's rate vs insurer's approved rate (highlighted differences)

### 7.3.2 Insurer Communication
- In-app messaging thread with assigned assessor (text + photo attachments)
- Negotiation log: all estimate changes tracked with timestamps and author
- Notification when assessor requests changes, approves, or rejects
- Automatic reminders to insurer if no response within configurable SLA (e.g., 48 hours)

## 7.4 Insurance Portal (Assessor & Admin)

### 7.4.1 Assessor Dashboard
A web-based portal where insurance assessors manage their queue of claims:
- Claims queue: new, in review, approved, rejected, in repair, completed
- Each claim card shows: workshop name, vehicle details, estimated cost, photos, days pending
- Priority flags: high-value claims (above configurable threshold), SLA breaches, re-inspections
- Quick actions: approve, reject, request revision, assign to another assessor

### 7.4.2 Estimate Review Interface
- Side-by-side view: workshop estimate vs insurer rate card
- Line-by-line approval: approve, adjust amount, or reject individual lines
- Auto-flag lines exceeding market rate by configurable percentage
- Total approved amount calculated in real time as assessor reviews
- Comments per line (visible to workshop for negotiation)
- One-click full approval with digital signature

### 7.4.3 Repair Monitoring
- Real-time repair status tracking (same lifecycle as workshop job card)
- Photo timeline: all photos uploaded by technician during repair, timestamped
- Milestone verification: configurable checkpoints (e.g., disassembly photos, pre-paint, final)
- Remote inspection capability — reduce need for physical revisits
- Completion verification: final photos required before payment authorisation

### 7.4.4 Insurance Admin Features
- Manage assessor accounts and assign workshop coverage areas
- Rate card management: upload and maintain approved labour rates and parts pricing
- Claims analytics dashboard: average approval time, approval rate, average claim value, fraud indicators
- Workshop performance scoring: quality ratings, claim frequency, cost accuracy
- Bulk payment processing: approve multiple completed claims for batch payment
- SLA configuration: set response time targets per claim type
- API integration hooks for insurer's existing claims management system

## 7.5 Fraud Prevention Features

- Photo metadata validation: GPS coordinates, timestamp, device ID
- Duplicate claim detection: same vehicle, same damage type within configurable period
- Estimate anomaly detection: flag estimates significantly above workshop's historical average for similar repairs
- Parts verification: cross-reference parts claimed vs parts catalogue pricing
- Audit trail: every action on a claim logged with timestamp, user, and IP

## 7.6 Insurance Data Model

| Entity | Key Fields | Notes |
|--------|------------|-------|
| insurance_companies | id, name, country, contact, rate_card_id, api_config | Insurer registry |
| insurance_claims | id, job_card_id, insurer_id, policy_number, claim_ref, status, excess_amount | Core claim record |
| claim_estimates | id, claim_id, version, submitted_at, total, status | Versioned estimates |
| estimate_lines | id, estimate_id, type (labour/parts), description, qty, workshop_rate, insurer_rate, status | Line-level review |
| claim_photos | id, claim_id, stage, photo_url, gps_lat, gps_lng, captured_at, device_id | Evidence photos with metadata |
| assessor_actions | id, claim_id, assessor_id, action_type, comment, created_at | Full audit trail |
| rate_cards | id, insurer_id, effective_from, labour_rates_json, parts_markup_rules | Insurer rate configuration |
| claim_payments | id, claim_id, invoice_id, amount, payment_ref, paid_at | Insurer payment tracking |
