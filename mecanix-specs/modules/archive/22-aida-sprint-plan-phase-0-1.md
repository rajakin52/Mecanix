# Mecanix AIDA — Sprint Plan (Phases 0 & 1)

**Companion to:** [Module 21 — AI Damage Assessment](./21-mecanix-ai-damage-assessment-spec.md)
**Horizon:** M0–M6 (12 sprints × 2 weeks)
**Why only the first 6 months:** Phase 2 commits depend on Phase 1 eval numbers. Planning Phases 2–5 before those numbers are back is fiction; this doc stops at the Phase 1 gate.
**Last updated:** 2026-04-21

---

## 0. Operating rules

- **Sprint length:** 2 weeks. No flexible boundaries. If a sprint slips, the slippage lives in the next sprint's scope, not the deadline.
- **Sprint planning day:** Monday week 1. Review Friday week 2. Demo Monday of following sprint.
- **Definition of done:** deployed to the environment the acceptance criteria specify (staging or prod) + automated test green + owner signed off.
- **One engineering lead owns the sprint plan**, not the PM. PM owns stakeholder comms and external dependencies (data vendors, legal).
- **Parallel tracks, not a serial line.** Every sprint has CV/ML, backend, product, compliance, GTM contributions where applicable. A sprint is "done" only when every applicable track is done.
- **Hard gate at Sprint 12.** Eval numbers in §4 are the go/no-go for Phase 2. Don't soften them mid-flight to make the gate pass.

## 1. Team shape (by phase)

| Role | Phase 0 (M0–M3) | Phase 1 (M3–M6) |
|---|---|---|
| Engineering lead | 1 | 1 |
| CV/ML engineer | 2 | 3 |
| Backend engineer | 2 | 3 |
| Frontend engineer | 1 | 2 |
| Product designer | 1 | 1 |
| Product manager | 1 | 1 |
| Customer success (shop onboarding) | 0 | 1 |
| Data ops (labeling coordination) | 0.5 | 0.5 |
| Compliance / legal | 0.5 | 1 |
| Insurer discovery lead | 0 | 0.5 |
| **Total FTE** | **~8** | **~13** |

Minimums, not maxima. If the team is smaller, **extend timelines — do not cut scope**. The Phase 1 gate is the scope; it's what Phase 2 buys a ticket to.

## 2. Running tracks across all 12 sprints

These are continuous workstreams, not sprint-owned. Each sprint touches them but none "finishes" them.

1. **Compliance & legal** — SOC 2 Type I kickoff (M0), audit (M3), DPA templates (M2), carrier legal reviews (M5).
2. **Data flywheel** — labeling pipeline + eval set freezing + per-carrier isolation controls from day one.
3. **Benchmark publishing** — public dataset numbers refreshed at the end of every sprint after #3.
4. **Stakeholder comms** — weekly carrier-discovery call log + monthly investor-ready metrics pack.

Progress on each track is reported at every sprint review.

---

## 3. Phase 0 — Foundations (Sprints 1–6, M0–M3)

**Phase goal:** Capture SDK works end-to-end on a small pilot shop with synthetic data. Panel segmentation v0 beats a public baseline. SOC 2 Type I in audit. 1–2 design-partner carriers signed under NDA.

### Sprint 1 (M0.0–M0.5) — Foundations kickoff

**Goal:** Team, tooling, legal skeleton in place. Nothing user-facing yet.

| Track | Deliverable |
|---|---|
| Eng lead | Sprint cadence established; trunk-based flow; CI/CD pipeline for Python + TS monorepo; staging cluster up. |
| CV | Public-dataset choice locked (CarDD, VehiDE, Stanford Cars + damage extensions). Licenses reviewed. |
| Backend | Tenant + carrier isolation primitives designed; schema diff reviewed against Module 21 §5.2 output shape. |
| Product | Advisor-guided capture UX mockups v0. |
| Compliance | SOC 2 Type I scope agreed with auditor; gap analysis started. |
| Legal | DPA template drafted; data-licensing contract shells drafted. |
| Data ops | Labeling-vendor shortlist (3 vendors) with RFP sent. |

**Acceptance:**
- CI green on Day 1 of Sprint 2.
- SOC 2 auditor signed statement of work.
- Labeling-vendor proposals in hand.

**Risks this sprint:** zero code shipped — morale. Counter: publish a weekly "foundations progress" note so the team sees the legal/infra moves.

---

### Sprint 2 (M0.5–M1.0) — Labeling + annotation schema

**Goal:** Annotation schema locked. First 10 000 photos labeled.

| Track | Deliverable |
|---|---|
| CV | Annotation schema v1 — panel list, damage taxonomy (dent, scratch, tear, crack, misalignment, paint blemish, missing), severity 1-5, confidence bins. Lock it. |
| CV | Train/val/test split strategy written: 80/10/10 on public datasets, stratified by panel + severity. |
| CV | Adjudication rubric for dual-annotator disagreements. |
| Data ops | Labeling vendor selected + SOW signed. First 10 k images uploaded. |
| Backend | Label ingestion pipeline: vendor output → internal storage → versioned dataset manifest. |
| Compliance | SOC 2 gap remediation plan; tenant-isolation tests drafted. |

**Acceptance:**
- 10 000 images with dual annotations + adjudication complete.
- Dataset v0 tagged in a storage bucket with immutable version ID.
- Annotation schema committed to `docs/aida/annotation-schema-v1.md`.

**Risks:** schema churn mid-labeling = rework on 10 k images. Counter: dogfood the schema on 200 images internally before the vendor touches the full batch.

---

### Sprint 3 (M1.0–M1.5) — Panel segmentation v0 + first benchmark

**Goal:** Panel segmentation model runs end-to-end. First numbers published.

| Track | Deliverable |
|---|---|
| CV | Mask2Former-class segmentation trained on dataset v0. Target: ≥ 75% mAP on val, ≥ 60% on public test. |
| CV | Inference server containerised; batch inference runs on H100 or equivalent. |
| CV | Public benchmark page scaffolded; first numbers posted (CarDD, VehiDE). |
| Backend | Inference API stub (no auth yet): `POST /cv/segment` returns masks + panel labels. |
| Product | Capture SDK UX spec v1 (still design-only). |
| Compliance | SOC 2 Type I control documentation 50% complete. |

**Acceptance:**
- Published benchmark page live behind a dev gate with Mecanix AIDA numbers and dataset reference.
- Inference API returns valid JSON for a sample image in < 2 s P95.
- Model weights + eval script checked into a reproducibility pack.

**Risks:** under-performing v0 model. Counter: pick architectures with strong public reproductions; don't chase novelty. If numbers are embarrassing, push benchmark publication to Sprint 5.

---

### Sprint 4 (M1.5–M2.0) — Capture SDK v0 (web)

**Goal:** Browser-based 8-shot capture flow works on a real device, end-to-end.

| Track | Deliverable |
|---|---|
| Frontend | Web capture SDK: 8-shot sequence with overlays, angle/distance enforcement, in-browser blur/glare rejection. Mobile Safari + Chrome. |
| Backend | `POST /aida/sessions` + `POST /aida/sessions/:id/media` — upload pipeline with multipart or signed-URL, staging bucket. |
| Backend | HEIC → JPEG normalisation on upload. |
| CV | On-ingest EXIF validation + blur/glare server-side check. |
| Product | Three-slot UX test with internal users (intake advisors from a partner shop) — capture a car in their lot. |
| Design | Final UX copy for capture prompts. |

**Acceptance:**
- 5 internal users complete 8-shot capture in ≤ 3 minutes, ≥ 80% of shots pass quality gate first try.
- Upload pipeline moves a session of 8 shots end-to-end in ≤ 20 s on 4G.

**Risks:** browser camera API quirks (iOS Safari vs. Android Chrome) eat a sprint. Counter: Day 1 smoke test on both devices before any other work.

---

### Sprint 5 (M2.0–M2.5) — Tablet-native capture + VIN OCR on-device

**Goal:** Same capture flow on a native tablet app. VIN OCR runs offline.

| Track | Deliverable |
|---|---|
| Frontend | React Native (or native Swift/Kotlin, decide before sprint start) capture app. Tablet-first. |
| CV | VIN OCR model quantised to int8; on-device inference < 500 ms. |
| CV | Quantised preview damage-classifier runs on-device for instant "rough" feedback. |
| Backend | NHTSA vPIC integration + local cache for VIN decode. |
| Compliance | DPA template reviewed by external counsel in all three launch geographies. |

**Acceptance:**
- Tablet app captures + uploads same session shape as web SDK.
- VIN OCR hits ≥ 95% on 100 known VIN test images (including windshield glare).
- App runs the full capture offline; sync completes when network returns.

**Risks:** picking React Native vs. native is a one-way door. Counter: make the call in Sprint 4 review, not mid-Sprint 5.

---

### Sprint 6 (M2.5–M3.0) — Phase 0 close-out + pre-Phase-1 readiness

**Goal:** Phase 0 exit gate. Everything Phase 1 needs to start on Day 1 of Sprint 7 is in place.

| Track | Deliverable |
|---|---|
| CV | Dataset v1 (25 k labelled images) complete. Panel segmentation retrained; ≥ 80% mAP on val. |
| Backend | Multi-tenant isolation tests passing; per-tenant model-version pinning scaffolded (empty for Phase 0, live in Phase 1). |
| Product | Advisor-guided UX flow pilot-tested with 1 real shop advisor under observation. Friction log written. |
| GTM | 6–10 insurer discovery conversations complete. 1–2 signed NDAs with design partners. |
| Compliance | SOC 2 Type I in audit window (observation period running). DPA approved by counsel in all 3 launch markets. |
| Data ops | Labeling-pipeline throughput benchmarked: sustained ≥ 5 k images/week at dual-annotation quality. |

**Acceptance (PHASE 0 GATE):**
- Panel segmentation ≥ 80% mAP on internal val set.
- Capture SDK (web + tablet) working end-to-end in staging with real vehicles.
- 1 NDA-signed carrier ready for Phase 2 design-partner kick-off.
- SOC 2 Type I audit observation started.
- Labeling pipeline sustained ≥ 5 k images/week.

**Outputs:** Phase 1 sprint pack (ready-to-run sprints 7–12).
**Decisions at this gate:** continue / slip / pivot. Do not enter Phase 1 without all acceptance items met.

---

## 4. Phase 1 — Shop alpha (Sprints 7–12, M3–M6)

**Phase goal:** AIDA is usable by an advisor inside Mecanix on a real RO, with enough accuracy to save time. Closed-loop training is running. 5 pilot shops live.

### Sprint 7 (M3.0–M3.5) — Shop integration skeleton

**Goal:** AIDA appears as a button on the existing Mecanix estimate screen. End-to-end path exists (even if model accuracy is rough).

| Track | Deliverable |
|---|---|
| Backend | `POST /aida/sessions/:id/submit` + `GET /aida/sessions/:id/estimate` live. Estimate object maps onto existing Mecanix Estimate schema. |
| Backend | Webhook `estimate.ready` fires to shop Mecanix instance. |
| Frontend | "AI Capture" button on the RO detail screen. Opens capture SDK. On completion, populates Estimate lines with evidence thumbnails. |
| CV | End-to-end inference pipeline: photos → panel segmentation → damage classification stub (untrained; returns "needs model") → operation decisioning stub → Estimate. |
| Product | Onboarding flow for the first pilot shop (data processing consent, training agreement). |
| Customer success | Pilot shop #1 signed, kickoff scheduled. |

**Acceptance:**
- Internal advisor captures a vehicle, hits Submit, sees a (possibly bad) AI-generated estimate in Mecanix within 90 s.
- Every line has a source-photo link and a (stubbed) confidence score.
- Webhook fires reliably.

**Risks:** shop Mecanix instance is behind a version the new Estimate fields aren't in. Counter: check shop-instance versions on pilot sign-up; backport if needed.

---

### Sprint 8 (M3.5–M4.0) — Damage classifier + severity

**Goal:** AI output is no longer stubbed. Damage classifier + severity head trained.

| Track | Deliverable |
|---|---|
| CV | Multi-label damage classifier (dent, scratch, tear, crack, misalignment, paint blemish, missing) trained on dataset v1 per-panel crops. Target ≥ 70% macro F1. |
| CV | Severity regression head trained. Target MAE ≤ 0.8 on 1–5 severity scale. |
| Backend | Inference pipeline wires new heads in; returns real damage + severity per panel with confidence. |
| Frontend | Low-confidence lines rendered yellow with "AI unsure — please verify" tooltip. |
| CV | Eval harness on held-out 5 k frozen set; auto-runs on every model release. |

**Acceptance:**
- Real damage classifier output in the estimate. Never a stubbed label.
- Low-confidence threshold tuned so ≤ 30% of lines are yellow on a representative internal test set.
- Eval harness CI green on every model tag.

**Risks:** severity distribution is skewed. Counter: re-sample the training set if P(severity=3) < 10% of rows.

---

### Sprint 9 (M4.0–M4.5) — Operation decisioning + parts catalog

**Goal:** AI recommends repair vs. replace vs. refinish per panel with auditable reason strings. Parts populate from a real catalog.

| Track | Deliverable |
|---|---|
| CV | Operation decisioning: GBM over (damage_class, severity, panel, material). Output: `repair` / `replace` / `refinish` / `R&I` / `blend`. Reason string generator. |
| CV | OEM position-statement rules v0 ingested as hard constraints (e.g., HSS sections forbidden from sectioning). |
| Backend | OEC (CollisionLink / RepairLink) parts-catalog integration — parts lookup by OEM + market-rate pricing index. |
| Backend | Shop-catalog integration: shop's own pricing overrides market rate on the shop-channel Estimate. |
| Product | Pilot shops #2–3 onboarded. |

**Acceptance:**
- 70% of AI-generated operations on pilot ROs match the estimator's final op (evaluated on first 200 pilot ROs once collected).
- Every operation line has a reason string an estimator can challenge.
- OEC or equivalent integration live for the first launch geography.

**Risks:** OEC contract hasn't closed. Counter: have a regional wholesaler fallback (manual SKU list) ready so the sprint doesn't block on a vendor.

---

### Sprint 10 (M4.5–M5.0) — Closed-loop training + monthly retraining

**Goal:** The data moat starts compounding. Every completed RO feeds training.

| Track | Deliverable |
|---|---|
| Backend | On RO completion: photos + initial AI output + estimator edits + parts consumed + labor clocked + final invoice → versioned training-set append. |
| Data ops | Monthly retraining pipeline live: scheduled job pulls latest training set, trains damage classifier + severity, runs eval, gates on no-regression vs. prior model. |
| Backend | Per-tenant model-version pinning: pilot shops pinned to current release unless they opt in to `latest`. |
| Compliance | Shop-channel data-sharing consent UX live in the RO signature flow. |
| Product | Pilot shop #4 onboarded. |

**Acceptance:**
- Training-set v2 assembled automatically from the first 500 completed pilot ROs.
- One monthly retraining cycle successfully run end-to-end with no-regression gate passing.
- Shop consent explicitly captured on each RO, auditable.

**Risks:** regression between monthly releases is hidden because the eval set is the wrong shape. Counter: freeze the 5 k eval set in Sprint 3 and never touch it.

---

### Sprint 11 (M5.0–M5.5) — Shop-owner dashboard + override tracking

**Goal:** Owners can see AIDA's impact. Estimators' overrides feed training cleanly.

| Track | Deliverable |
|---|---|
| Frontend | Shop-owner dashboard: time-to-estimate with/without AIDA, override rate per estimator, per-panel accuracy trendline. |
| Backend | Override diff-tracking: every edit stored as `{ai_output, human_output, reason?}`. |
| Backend | "Promote to training example" one-click on the Estimate screen (subject to tenant consent). |
| Product | Pilot shop #5 onboarded. All 5 pilot shops running. |
| GTM | First insurer design-partner technical deep-dive call (Phase 2 pre-work). |

**Acceptance:**
- Dashboard renders real metrics for each pilot shop, refreshed nightly.
- Override diff stored on every estimator edit — zero-loss.
- "Promote to training" round-trip tested end-to-end.

---

### Sprint 12 (M5.5–M6.0) — Phase 1 eval gate

**Goal:** Hit the Phase 1 eval bar — or don't — and decide Phase 2 accordingly.

| Track | Deliverable |
|---|---|
| CV | Final Phase 1 eval pass on the frozen 5 k held-out set. All metrics logged. |
| Backend | Performance: P95 latency from capture-complete → estimate-ready ≤ 90 s measured across the last 200 pilot ROs. |
| Data ops | Dataset v3 (≥ 50 k labelled images including pilot-shop ground truth) complete. |
| Compliance | SOC 2 Type I report delivered. |
| GTM | Phase 2 design-partner carrier agreement drafts ready for signature. |
| Eng lead | Phase 1 retrospective + Phase 2 sprint pack written. |

**ACCEPTANCE (PHASE 1 GATE — hard):**
- Panel segmentation ≥ 80% mAP on held-out set.
- Damage classification ≥ 70% macro F1 on held-out set.
- Operation match ≥ 60% vs. estimator's final op on last 200 pilot ROs.
- Time-to-estimate P95 ≤ 90 s end-to-end.
- 5 pilot shops running with ≥ 50 completed ROs each.
- SOC 2 Type I report in hand.
- Monthly retraining cycle run ≥ 2 consecutive months with no-regression gate passing.

**If all green:** Phase 2 starts Sprint 13. Open the paid design-partner motion.
**If any red:** Do not proceed to Phase 2. Extend Phase 1 by 1 month to hit the missing metric. Adjust Phase 2 start date accordingly. Never soften the gate.

---

## 5. Dependencies that can derail this plan

Listed so the eng lead can chase them before they become blockers.

| Dep | Needed by | Owner | Risk if late |
|---|---|---|---|
| Labeling-vendor contract | Sprint 2 | PM | Whole CV plan slips |
| OEC / PartsTrader contract | Sprint 9 | PM / Legal | Parts integration stub, estimates lose credibility |
| SOC 2 Type I auditor SOW | Sprint 1 | Compliance | Phase 1 gate misses SOC 2 deliverable |
| 2 NDA-signed carriers | Sprint 6 | Insurer discovery lead | Phase 2 has no pilot partner |
| 5 pilot shops opted in | Sprint 11 | Customer success | Closed-loop data is thin; gate metrics suffer |
| H100 (or equivalent) GPU capacity | Sprint 3 | Eng lead | Training is slow; retraining cadence impossible |
| Mecanix core-app Estimate schema changes | Sprint 7 | Eng lead | AIDA button can't populate existing estimate |

Run a weekly 15-min dependency-risk review. Chase anything yellow; escalate anything red to exec.

---

## 6. What's deliberately NOT in this plan

- Phases 2–5. Planning them now pretends we know numbers we won't have until Sprint 12.
- Insurer-facing `/assess` API beyond design-partner discovery. It's Phase 2+.
- Physical-inspection / T3 assessor network. Phase 3.
- Walk-around video capture. Pushed to Phase 2. Phase 1 is photo-only.
- Customer self-capture browser flow. Pushed to Phase 2.
- Paint-blend detection. Open question in Module 21 §11; decide in Phase 2 discovery.

Each of these is in Module 21 and will be sprint-planned **after** the Phase 1 gate clears.

---

## 7. What changes between this and a "waterfall" plan

This is an agile plan with hard gates, not a Gantt chart:

- Scope per sprint is fixed. Duration is not — if Sprint 8 needs 3 weeks to hit its acceptance, it takes 3 weeks, and Sprint 9 moves. The M6 gate shifts accordingly.
- The gate at Sprint 6 and Sprint 12 are **real go/no-go points**. Don't rename a miss "partial completion."
- Running tracks (compliance, benchmark publishing) never get deprioritised in a sprint. They're load-bearing for credibility in Phase 2.
- Retrospective every sprint. Adjust working rules, not gate metrics.

---

## 8. One-line sprint-by-sprint map

```
Sprint 1  Foundations kickoff — team + tooling + legal skeleton
Sprint 2  Labeling + annotation schema locked — 10k images
Sprint 3  Panel segmentation v0 + first public benchmark posted
Sprint 4  Capture SDK v0 (web) end-to-end on mobile browsers
Sprint 5  Capture SDK v0 (tablet native) + VIN OCR on-device
Sprint 6  PHASE 0 GATE — 80% panel mAP, 2 NDA carriers, SOC 2 in audit
Sprint 7  Shop integration skeleton — AI Capture button in Mecanix
Sprint 8  Damage classifier + severity trained — real, not stubbed
Sprint 9  Operation decisioning + parts catalog live (OEC)
Sprint 10 Closed-loop training pipeline — monthly retraining running
Sprint 11 Shop-owner dashboard + override tracking
Sprint 12 PHASE 1 GATE — 80/70/60 metrics, 5 pilot shops, SOC 2 Type I done
```
