# AIDA v1 — Sprint Plan

**Last updated:** 2026-04-22
**Author:** Raja + Claude
**Posture:** AIDA ships as a Mecanix module that workshops use on their own jobs. Using a hosted foundation model (Claude vision), not a trained CV model. Insurer-as-tenant stays architecturally possible; legal + audit work deferred until an insurer actually signs. See `future-insurer-tenant-readiness.md` for the forward-compat notes.

**Supersedes:** Module 22's 12-sprint AIDA plan. That plan targeted a two-sided insurer-facing business with a custom-trained CV model. Different product.

---

## Why this plan exists

The existing `damage_assessments` / `assessment_photos` / `assessment_findings` / `assessment_operations` tables (migrations 00089/00090) already support everything needed for a full damage-assessment workflow **except** one thing: **nothing actually populates findings/operations automatically**. The `source` enum reserves `aida_v0` and `aida_v1` slots but all rows today are `manual`.

This plan wires Claude vision into that gap. It does not add tables, does not change the existing UI more than needed, does not bolt on a separate CV stack.

---

## Sprints

Each sprint is 3–5 focused working sessions. Order matters — don't parallelize.

### Sprint A — Claude-vision analyse endpoint (core)

Goal: an estimator hits "Analyse" on a `damage_assessments` row with uploaded photos and gets AI-populated findings + operations back.

**Work:**

1. Add `AiService.analyseDamage()` mirroring the `ocrReceipt` pattern. Input: array of base64 photos (+ optional vehicle make/model/year hint from the parent `damage_assessments.vehicle_id`). Output: `{ findings[], operations[], confidence, raw? }`.
2. Prompt engineering. System prompt: structured JSON output only, with panel taxonomy matching the existing `assessment_findings.panel` free-text values the UI uses today (e.g. `front_bumper`, `left_front_door`). Damage type matches existing enum (`dent`, `scratch`, `tear`, `crack`, `misalignment`, `paint_blemish`, `missing`). Severity 1-5.
3. Add `AidaService.analyse(tenantId, assessmentId, userId)`:
   - Load assessment + its photos
   - Download each photo from Supabase Storage, re-encode base64 with media type
   - Call `aiService.analyseDamage()`
   - Insert finding rows (`source='model'`, model_version=`claude-sonnet-4-6-vision-v1`)
   - Insert operation rows (`source='model'`) with `labour_hours`/`parts_cost`/`paint_cost` from the model
   - Transition assessment `status`: `'capturing'` → `'analysing'` → `'ready'` (or `'capturing'` on failure + surface error)
   - Call `recalculateTotals`
4. Controller: `POST /aida/assessments/:id/analyse` (no body; all inputs derived from the assessment).
5. Model choice: `claude-opus-4-7` for vision quality. Damage assessment drives real money decisions; the headroom matters. Cost per analysis ~$0.08; tenant cap in Sprint C.
6. Idempotency: if the assessment already has model-sourced findings (`source='model'`), return them — don't re-bill. Force-re-analyse is a separate call `POST .../analyse?force=true`.

**Acceptance:**
- Creating an assessment, uploading 2-3 real damage photos, hitting analyse → findings + operations populated in DB with confidence scores.
- Estimator sees them in the existing UI alongside any manually-added rows.
- Existing `finalise` / push-to-job flow works unchanged.

---

### Sprint B — Estimator UX polish (the review loop)

Goal: the estimator trusts the AI output enough to approve or correct with minimum friction.

**Work:**

1. Low-confidence rendering. On the assessment detail page, findings/operations with `confidence < 0.7` render with a yellow badge and a tooltip ("AI unsure — verify").
2. Bounding-box evidence. The Claude prompt already returns a `photo_ref` per finding (which photo the damage was spotted in); store that on `assessment_findings.photo_id`. UI: tapping a finding opens the photo with the finding highlighted in a bubble.
3. Edit tracking. When an estimator edits a model-sourced row, the row's `source` flips to `reviewer_override`. Before/after both stored on a new `assessment_edits` table (future learning signal).
4. Re-analyse. A "re-analyse with current photos" button; hits `POST .../analyse?force=true`.

**Acceptance:**
- Yellow low-confidence chips visible in the UI.
- Clicking any model-sourced finding jumps to the evidence photo.
- Editing a model-sourced row writes an edit log row.

---

### Sprint C — Status quality + observability

Goal: we know when the AI is good enough to trust, and we know when it fails silently.

**Work:**

1. Surface model outputs that failed to parse as an error on the assessment with a "retry" affordance (don't swallow and return empty).
2. Per-tenant stats: how many analyses run, how many findings edited by the estimator (proxy for accuracy), average confidence. Lightweight view on `damage_assessments` admin page.
3. Cost ceiling: a tenant-settings cap `aida.monthly_analyses_max` (default 200). Service refuses to call the model over the cap for the month, returns a clear error.

**Acceptance:**
- A malformed model response shows a clear error state instead of an empty ready assessment.
- Admin view shows: analyses/month, edit rate, avg confidence.
- Going over the monthly cap blocks with a helpful message, not a silent stall.

---

## Out of scope for v1

- Walk-around video analysis (v1 is photos only).
- OEM parts lookup / market-rate pricing. Model returns estimated costs; estimator confirms.
- VIN OCR. Workshop enters the vehicle manually at assessment creation, same as today.
- Training a custom model, labeling datasets, managing GPU infra. Claude handles inference.
- External `/assess` API for insurers. Deferred per `future-insurer-tenant-readiness.md`.
- SOC 2, DPA, GDPR counsel. Deferred until an insurer is 30 days from signing.
- Shop-identity stripping. One-liner when needed later.

---

## Dependencies

- `ANTHROPIC_API_KEY` env var set in Railway API service (already set — `AiService` uses it).
- Claude Sonnet 4.6 pricing at current rates. A typical assessment at ~3 photos × ~1.5MB each costs on the order of $0.02 — well under $5/month even at 200 analyses.

---

## When to revisit

After Sprint A: measure edit rate (how often the estimator corrects AI output). If > 50%, prompt engineering and/or photo-quality gating is the next priority, not Sprint B.
