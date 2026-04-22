# Mecanix — AI Damage Assessment Module

**Spec version:** 0.1 (draft)
**Owner:** Product
**Audience:** Product + Engineering
**Status:** For review
**Last updated:** 2026-04-21

---

## 1. Summary

Mecanix will add a native AI Damage Assessment (AIDA) module that ingests photos and short videos of a damaged vehicle and produces a structured damage assessment: identified parts, damage types and severities, recommended operations (repair vs. replace vs. refinish), estimated labor hours, parts cost, and a repair-vs-total-loss indicator.

AIDA is built as a **two-sided product from day one**. The two sides share the same CV stack and data moat, but they are **distinct products with distinct contracts, workflows, and commercials**:

- **Core garage business:** AIDA embedded in the shop workflow. The shop uses it on its own incoming jobs to speed up estimating. The shop owns the estimate and (usually) also performs the repair. Customer is the shop owner.
- **Financial damage assessment service for insurers:** AIDA packaged as an API + reviewer console + physical-inspection network. An insurer sends a claim to Mecanix; Mecanix returns a **financial damage assessment** — a structured estimate of what the repair will cost, a repair-vs-total-loss indicator, and a confidence score — produced either purely from photos, with remote Mecanix-reviewer oversight, or with physical inspection by a Mecanix-certified assessor. **The car may be repaired anywhere** — at a Mecanix shop, at a shop outside our network, or not at all. Mecanix is paid for the assessment, not the repair. Customer is the insurer.

**What this product is not:** it is not a statutory or legal expertise service. We are not replacing accredited vehicle-damage experts in regulated markets (France's *expert en automobile*, Germany's *Kfz-Sachverständiger*, etc.). Where a carrier's claim legally requires an accredited expert signature, that remains outside Mecanix's scope; the carrier uses their existing expert network for those cases. Mecanix handles the bulk of claim volume where a fast, accurate, neutral **financial** assessment is what the insurer actually needs.

The assessor shop in T3 is acting as a neutral financial assessor on behalf of the insurer — compensated for neutrality, not for winning the job.

The module is built **fully in-house**. We are not reselling Tractable, CCC, Qapter, or Inspektlabs — we are directly competing with them for the insurer wallet, while also protecting and growing the shop franchise.

Our thesis is structural: every existing vendor is optimized for one side of the transaction. Tractable, CCC, Qapter are optimized for the **insurer's** decisioning from a desk. Inspektlabs is optimized for fleet / dealer inspection. None of them has a physical network of shops that can double as independent assessors when photos alone aren't enough. Mecanix does. That — plus the ground-truth repair data we collect from shop-channel customers — is the defensible wedge into the insurer market.

---

## 2. Goals and Non-Goals

### 2.1 Goals

**Shop-side (core garage business)**
- Ship a photo/video → structured estimate flow inside Mecanix usable by a shop advisor in under 90 seconds per vehicle.
- Surface a **parts + operations** output that maps 1:1 onto Mecanix's existing estimate object, editable line by line inside the current Estimate screen.
- Capture a closed-loop ground-truth dataset from every repair completed in Mecanix, and use it to retrain monthly.
- Support three capture modes: advisor-at-counter (tethered), customer self-capture (link), and drop-off walk-around (video).

**Insurer-side (financial damage assessment service)**
- Ship a carrier-facing API (`/assess`) and a hosted reviewer console that accept a claim with photos/video (and optionally a request for physical inspection) and return a structured financial damage assessment: panels and operations, cost range, repair-vs-total-loss indicator, and confidence score, under a published SLA.
- Offer three service tiers to insurers:
  - **T1 — AI-only** (photo-based, sub-60s machine assessment)
  - **T2 — AI + Mecanix remote reviewer** (centralized Mecanix reviewer validates AI output; SLA 15 min business hours)
  - **T3 — AI + physical inspection** (Mecanix dispatches a certified assessor shop; vehicle is inspected in person within 48 h)
- Produce every assessment with **auditable reason strings**, **evidence bounding boxes**, and **assessor identity** (for T3) so an adjuster can challenge any line.
- Reach within **5 percentage points** of Tractable's published touchless-estimate accuracy on a shared public benchmark within 12 months of GA (T1 tier).
- Integrate with at least the top 3 claims-system vendors per launch geography (Guidewire, Duck Creek, Sapiens) via connectors.
- Explicitly separate assessment output from any downstream repair: the assessment object is **insurer-owned, not shop-owned**, and contains no commercial bias toward a particular repairer. Mecanix-shop identity is stripped from any assessment shared back with the insurer unless the insurer explicitly wants the shop that inspected the vehicle to be named.

**Cross-cutting**
- Ground every insurer-facing assessment in real-world repair data from our shop network (the data moat). Assessments are benchmarked against *what a repair actually costs*, not what a model predicts in the abstract — even when the vehicle in question is repaired outside the Mecanix network.

### 2.2 Non-Goals (v1)

- **Statutory / legal expertise.** We do not produce accredited-expert reports for regulated markets (France *expertise automobile*, Germany *Kfz-Gutachten*, etc.). Claims that legally require an accredited expert signature are out of scope; carriers route those through their existing expert networks.
- Subrogation and fault attribution. Future.
- Full total-loss **settlement** math. We surface "suspected total loss" with a cost range and the inputs an adjuster needs, but we do not output a carrier's final settlement number in v1.
- Structural / frame damage quantification beyond "suspected — requires measurement." Frame work needs a measuring system, not a camera.
- Bodily injury, medical, or liability assessment. Vehicle damage only.
- Languages beyond EN, ES, FR at GA.
- First-notice-of-loss (FNOL) intake orchestration. We consume an FNOL from the carrier, we do not replace it.

---

## 3. Competitive Benchmark

We are benchmarking against the four vendors a shop, insurer, or investor will bring up when they evaluate Mecanix AIDA.

### 3.1 Who they are and what they optimize for

| Vendor | Core optimization | Primary buyer | Deployment shape | Data moat |
|---|---|---|---|---|
| **Tractable** | Model accuracy on photo-based damage detection and repair/replace decisioning | Insurers (global) | API, embedded in carrier claims system | Large, globally diverse claims corpus; research-heavy team |
| **CCC Intelligent Solutions** | End-to-end estimating workflow tied to parts, labor, and payment rails | US insurers + US body shops | Platform + network | Sees actual repair outcomes on the majority of US claims — unmatched closed loop |
| **Qapter (Solera / Audatex)** | AI layer on top of the Audatex estimating standard | Insurers and shops (EU-heavy) | Embedded in Audatex | Tight coupling to Audatex parts + labor catalog across ~100 countries |
| **Inspektlabs** | Multi-frame / video inspection for fleet and used-car | Fleet, dealer, rental, some insurers | API + white-label web capture | Strong 360° video aggregation; narrower domain |

### 3.2 Capability matrix

Legend: ● strong, ◐ partial, ○ weak / not a focus. These assessments are based on public material and industry reputation as of 2026-Q1; numbers in §3.3 must come from our own benchmark, not their marketing.

| Capability | Tractable | CCC | Qapter | Inspektlabs | Mecanix target (v1) |
|---|---|---|---|---|---|
| Panel / part identification from photo | ● | ● | ● | ● | ● |
| Damage type classification (dent, scratch, crack, tear, misalignment, etc.) | ● | ● | ◐ | ● | ● |
| Severity grading | ● | ● | ◐ | ◐ | ● |
| Repair-vs-replace decision | ● | ● | ◐ | ◐ | ● |
| Paint / refinish operation detection | ◐ | ● | ◐ | ○ | ● |
| Labor-hour estimate | ◐ | ● | ● | ○ | ● |
| Parts lookup + pricing | ◐ | ● | ● | ○ | ● (via shop catalog) |
| 360° video walk-around | ◐ | ◐ | ○ | ● | ◐ (v1), ● (v2) |
| Total-loss flag | ● | ● | ● | ○ | ◐ (flag only, not settlement) |
| Pre-existing damage detection | ◐ | ◐ | ◐ | ● | ◐ |
| Shop-side workflow (workorder, tech assignment, parts order) | ○ | ◐ | ○ | ○ | ● |
| Insurer-side workflow (claims-system integration, adjuster review) | ● | ● | ● | ◐ | ● |
| Closed-loop ground truth from actual repair | ○ | ● | ◐ | ○ | ● |
| Dual-sided (shop + insurer) as a single product | ○ | ◐ | ○ | ○ | ● |
| Works offline / low bandwidth | ○ | ○ | ○ | ◐ | ● |

### 3.3 What we will measure against them

We cannot get their models inside our eval harness directly, but we can benchmark against their **published** numbers and against shared public datasets. The benchmark plan:

1. **Public dataset benchmark.** Run Mecanix AIDA against CarDD, VehiDE, and a curated subset of the Stanford Cars + damage-annotated extensions. Report mAP on panel detection, F1 on damage classification, and accuracy on repair-vs-replace. Publish so others can reproduce.
2. **Shadow benchmark on our own data.** Once we have 10k shop-completed repairs with photos + final invoice, compute: percentage of AI-suggested operations that match the final repair order, labor-hour MAE vs. actual, parts-list precision/recall vs. actual parts consumed.
3. **Vendor-published baselines we must beat or match.**
   - Tractable: claims >95% panel-level accuracy and sub-minute photo estimates in production. Our bar: **≥ 90% at GA, ≥ 95% within 12 months**, on our public benchmark.
   - CCC: claims >85% "touchless" throughput on appropriate claim segments. Our bar: **≥ 70% touchless at GA on shop-appropriate claims (cosmetic + light collision).**
   - Qapter: positions on Audatex parts catalog coverage. Our bar: **parts coverage ≥ 98% of VIO in target markets via our catalog integration.**
   - Inspektlabs: multi-frame video consistency. Our bar: **variance of damage classification across frames of the same panel ≤ 3%.**

Any number a vendor publishes without a reproducible dataset is treated as directional, not ground truth. We commit to publishing ours on a dataset anyone can run.

### 3.4 Where we win, where we lose

**Where Mecanix wins by construction:**

- **Ground-truth data moat (the big one).** Shops using Mecanix for their own repair business tell us what was actually repaired on *their* jobs, what parts were ordered, what techs clocked, and what the final invoice was. That training corpus is what makes our models accurate. When we then sell assessments to insurers on *other* vehicles (that may be repaired anywhere), our model is still the one trained on real repair outcomes. Only CCC has something comparable, and only in the US. Tractable, Qapter, Inspektlabs have none of it. This is the wedge that lets us undercut and out-accuracy them on insurer contracts.
- **Physical network of assessors.** We are the only player in this list with a distributed network of shops that can perform in-person inspection when photos aren't enough. Tractable, Qapter, Inspektlabs are software-only. CCC has a network but it is deeply tied to the US insurance-repair-payment triangle. Our assessor network can be spun up where our shop customers already are, and can be paid as a per-job fee for neutrality — not as the repairer.
- **Cost per inference.** We own the stack, so we can run quantized models on-device for the assessor tablet, which collapses marginal cost and works offline.
- **Vertical tuning.** Our model is trained on shop-grade photos *and* insurer FNOL photos. The dual distribution gives us robustness single-sided vendors don't have.
- **Faster feedback loop.** For the subset of assessments where the vehicle is subsequently repaired at a Mecanix shop, we close the loop with ground truth. For the rest, we rely on carrier-returned settlement outcomes (see §6.4) — still better than what any competitor has.

**Where we will lose without explicit investment:**

- **Brand trust with insurers.** Carriers trust Tractable and CCC. Mecanix is a new name in procurement conversations. Mitigation: publish benchmark methodology, invite third-party audit, land 1–2 lighthouse carrier pilots before general sales, SOC 2 Type II before first paid integration.
- **Catalog breadth.** Qapter and CCC have decades of parts catalog depth. Mitigation: wholesale-catalog integrations (OEC, PartsTrader, regional equivalents) before we try to own it ourselves.
- **Claims-system integration depth.** CCC is embedded in carrier workflows at a depth that takes years to match. Mitigation: ship a Guidewire connector and a Duck Creek connector in Phase 2; don't try to displace the claims system, integrate with it.
- **Total-loss calibration.** We are not building a settlement model in v1. Accept this; surface "suspected total loss" and defer the number to the adjuster.
- **Global VIO coverage.** Solera wins on breadth. Mitigation: pick 3 launch geographies and go deep rather than wide.
- **Channel conflict.** If we sell assessments to insurers, some carriers may view Mecanix as competitive with their in-house adjuster function, and some shops may worry we're taking the insurer's side. Mitigation: explicit two-sided positioning, transparent pricing, never share shop-identifiable data with carriers without contractual consent, never share carrier-identifiable data with shops.

---

## 4. User stories

### 4.1 Service advisor — drive-up estimate

> As a service advisor, when a customer pulls up with collision damage, I want to capture photos on the shop tablet and get a full estimate in under two minutes so I can quote the customer before they leave the counter.

**Acceptance criteria:**
- Advisor opens a new RO, taps "AI Capture," captures a guided 8-shot sequence (4 corners + 4 closeups).
- Within 90 seconds of the last photo, an editable estimate is populated with parts, operations, labor hours, and paint times.
- Advisor can accept, edit, or reject any line. Every edit is logged and feeds training.
- If confidence is below threshold on any panel, that line is flagged yellow with "AI unsure — please verify."

### 4.2 Customer self-capture — pre-arrival

> As a customer booking a repair, I want to send photos through a link so the shop can tell me whether it's worth coming in and give me a rough estimate.

**Acceptance criteria:**
- Advisor sends an SMS/email link; customer opens a browser flow with guided capture overlays.
- Customer submits; shop receives a "preliminary estimate" with explicit disclaimer that a physical inspection is required before a firm quote.
- Flow works on iOS Safari and Android Chrome without app install.

### 4.3 Walk-around video on drop-off

> As a shop manager, I want every drop-off to be documented with a 60-second walk-around video so we have pre-existing damage on record and can assess new damage against it later.

**Acceptance criteria:**
- Advisor records a continuous 360° video; system extracts keyframes and annotates pre-existing damage.
- On repair completion, system can diff against the intake video to confirm no in-shop damage was introduced.

### 4.4 Estimator — AI-assisted refinement

> As an estimator, I want the AI to give me a first-pass estimate I can refine, not replace me, so I stay in control of the final number.

**Acceptance criteria:**
- Every AI-generated line shows a confidence score and the source photo.
- Estimator edits are diff-tracked and feed monthly retraining.
- Estimator can "promote" a corrected estimate to a labeled training example with one click (subject to customer consent).

### 4.5 Shop owner — performance visibility

> As an owner, I want to see how much time AIDA is saving and how often the estimator has to override it, so I know if it's earning its seat.

**Acceptance criteria:**
- Dashboard: average time-to-estimate with vs. without AIDA, override rate per estimator, per-panel accuracy trendline, estimated labor-hour cost per estimate.

### 4.6 Insurer claims adjuster — AI-first assessment

> As an adjuster, when a claim comes in with FNOL photos, I want an instant independent damage assessment with a confidence score and evidence, so I can triage: close simple claims fast, escalate complex ones, and spend my time on the cases that need me. I don't want the assessment to be biased by whoever might end up repairing the car.

**Acceptance criteria:**
- Carrier system posts a claim to `POST /assess` with photos/video, VIN, loss details, and service tier (T1–T3).
- Within the tier's SLA (T1: 60 s P95; T2: 15 min P95 business hours; T3: 48 h for in-person inspection), the carrier receives a structured assessment: panels, operations, parts, cost range, repair-vs-total-loss indicator, overall and per-line confidence.
- The assessment **does not** recommend a specific repairer and **does not** contain shop-side commercial pricing. Parts/labor costs are based on regional market-rate indices and the assessor's labor guide, not any individual shop's invoicing.
- Every line has an evidence bounding box tied to a source photo.
- Every line has an auditable reason string ("replace recommended: tear >150mm on high-strength steel quarter panel; OEM bulletin prohibits sectioning").
- For T3, the assessor's identity is on the report.
- The assessment is framed as a **financial estimate for claims processing**, not a legal expertise. The report explicitly states this.
- Adjuster can accept, edit, or reject in the Mecanix reviewer console or in their own claims system (via connector).
- Adjuster edits flow back into training if the carrier has opted into the data-sharing agreement.

### 4.7 Insurer claims manager — portfolio oversight

> As a claims manager, I want to see how AIDA is performing across my book — accuracy vs. the final settlement, cycle-time reduction, and cost-per-claim — so I can justify the contract at renewal.

**Acceptance criteria:**
- Dashboard per carrier: assessment volume, AI-only vs. reviewed split, mean absolute error of AI cost estimate vs. final settlement, cycle-time reduction, touchless rate, leakage metrics.
- Exportable reports for reinsurer and regulator audits.
- Model-version history: which AIDA release handled which claims, so a claim's assessment can be reproduced on request.

### 4.8 Insurer SIU / fraud analyst — photo provenance

> As a fraud analyst, I want to know whether the photos submitted on a claim are consistent with each other and with the reported loss, so I can flag suspicious claims for deeper review.

**Acceptance criteria:**
- AIDA surfaces provenance signals: EXIF consistency, geo/time consistency across photos, panel damage consistency (e.g., rear damage reported but front-end impact patterns present), duplicate-image detection against prior claims in the shared pool (carrier-opted).
- Flags are advisory, not decisive; the analyst investigates.

### 4.9 Mecanix assessment reviewer (internal, T2) — human-in-the-loop service

> As a Mecanix-employed reviewer, I want a queue of AI-assessed claims with the lowest confidence cases prioritized, so I can review and send within SLA.

**Acceptance criteria:**
- Reviewer console with prioritized queue sorted by SLA remaining and AI confidence.
- One-click accept, line-level edit, or escalate to senior reviewer or to a T3 physical inspection.
- Every action is timed and attributed for QA and SLA reporting.

### 4.10 Certified assessor shop (T3) — physical inspection on behalf of insurer

> As a Mecanix-certified assessor, when an insurer requests a physical inspection, I want a dispatch to come into my queue with the claim context and the AI preview, so I can inspect the vehicle, confirm or correct the AI assessment, and return a signed report. I am paid a fixed assessment fee regardless of whether the vehicle is ultimately repaired at my shop or anywhere else.

**Acceptance criteria:**
- Assessor receives a dispatch notification in the Mecanix app with claim context, AI preview assessment, customer contact info, and SLA clock.
- Assessor contacts the vehicle owner, schedules inspection (at the shop or on-site), captures the required photo/video protocol on a Mecanix tablet.
- Assessor reviews AI output, edits any line with reason strings, and submits a signed assessment report. Signature is cryptographic and tied to the assessor's Mecanix identity.
- Assessor is paid a **fixed assessment fee** per job, not a percentage of the repair. This is hard-coded in the contract and surfaced transparently in the assessor's earnings view.
- The assessor may quote the repair separately if the customer wants it, but that quote is a distinct object from the assessment and is not visible to the insurer unless the customer and insurer both consent.
- If the vehicle is repaired elsewhere, the assessor has no claim on the repair revenue. The fixed fee is the full compensation.


---

## 5. Functional scope (v1)

### 5.1 Inputs

**Shop-side**
- Still photos (JPEG, HEIC, PNG), up to 20 per RO.
- Short video clips (MP4, MOV), up to 90 s, for walk-around.
- VIN (manual or scanned from windshield / door jamb). Required.
- Odometer reading. Optional but used for depreciation signals on total-loss flag.
- Prior RO history on this VIN in this shop. Used for pre-existing damage reasoning.

**Insurer-side (assessment service)**
- Claim ID from the carrier's system (opaque to us).
- Photos and/or video from FNOL. Source may be customer self-capture via the carrier's app, an adjuster on-site, or a third-party inspector.
- VIN, policy-declared vehicle, reported loss description (collision, theft, vandalism, weather, etc.), date of loss.
- Optional: prior loss history on the VIN, deductible, policy coverages (used only as filters on our output, not to bias the damage model).
- Service tier selector: `t1_ai_only`, `t2_ai_plus_mecanix_review`, `t3_physical_inspection`.

### 5.2 Outputs

Two distinct output objects, sharing a common core but with different semantics and ownership:

**`Estimate` (shop channel)** — owned by the shop, used to quote the shop's own customer.
- `vehicle`: decoded VIN, year/make/model/trim, paint code if detectable.
- `panels[]`: list of affected panels with damage type, severity, confidence.
- `operations[]`: repair / replace / refinish / blend / R&I, with labor hours.
- `parts[]`: OEM and aftermarket options from **the shop's own catalog**, with the shop's negotiated pricing.
- `paint[]`: refinish operations with labor time and material cost.
- `shop_pricing`: the shop's commercial rates applied.
- `flags[]`, `evidence[]`: as before.

**`Assessment` (insurer channel)** — owned by the insurer. Explicitly neutral.
- `vehicle`: as above.
- `panels[]`, `operations[]`: as above, but derived from the same CV pipeline regardless of which shop (if any) is involved.
- `parts[]`: OEM part numbers and **market-rate** pricing indices per region, not any individual shop's pricing.
- `labor_cost`: based on a published regional labor-rate index and the assessor's labor guide, not any individual shop's door rate.
- `cost_range`: low/likely/high bands for the whole repair.
- `total_loss_indicator`: `likely_repair`, `borderline`, `likely_total_loss` with rationale and ACV inputs.
- `assessor_identity`: for T3, the identity of the physical assessor. Absent for T1/T2.
- `flags[]`, `evidence[]`: as before, plus `photo_provenance` (EXIF consistency, duplicate detection across claims in the carrier-scoped pool).
- `report_url`: a signed PDF rendering of the assessment, formatted to the carrier's preferred template. Report explicitly states it is a **financial damage assessment for claims-handling purposes**, not a legal or statutory expertise.
- **Does not contain** shop commercial pricing, shop identity (except assessor for T3), or any repair-routing recommendation.

### 5.3 Capture flows

Three capture modes. All three produce the same output schema.

1. **Advisor-guided tablet capture.** 8-shot guided sequence with on-screen overlays for angle and distance. Fastest path; highest-quality input; default for in-shop.
2. **Customer link capture.** Browser-based; same overlays as tablet; results marked "preliminary."
3. **Walk-around video.** Continuous video, server-side keyframe extraction and panel-level aggregation across frames.

### 5.4 Human-in-the-loop

Every AI output is editable. No line is ever auto-finalized. An estimator's explicit "approve" click is required before an RO moves from `draft` to `quoted`. Edits are diffed and stored as training signal.

---

## 6. Technical architecture

### 6.1 Pipeline

```
Capture (tablet / web / video)
     │
     ▼
Image preprocessing
  • EXIF normalization, HEIC→JPEG
  • Vehicle presence check
  • Blur / glare / occlusion rejection with retry prompts
     │
     ▼
Vehicle identification
  • VIN decode (NHTSA vPIC + our cache)
  • Make/model/trim confirmation via model
     │
     ▼
Damage CV stack
  • Panel segmentation (instance segmentation, ~Mask2Former family)
  • Damage detection per panel (multi-label classifier)
  • Severity regression per (panel, damage type)
  • Multi-frame aggregation for video
     │
     ▼
Operation decisioning
  • Repair vs. replace vs. refinish per panel
  • Driven by damage class + severity + panel type + material (steel / alu / plastic / CFRP)
  • OEM position-statement rules layered on top (hard constraints)
     │
     ▼
Labor + parts mapping
  • Operations → labor-hour lookup (our catalog, initially seeded from OEM + Motor + regional standards)
  • Parts → shop catalog integration (OEC / PartsTrader / regional)
     │
     ▼
Estimate assembly
  • Fill Estimate object
  • Attach evidence (bounding boxes per line)
  • Apply flags + confidence thresholds
     │
     ▼
Mecanix Estimate screen (human edits here)
     │
     ▼
Closed-loop capture
  • On RO completion: actual parts, actual labor, actual invoice → training set
```

### 6.2 Models (v1 choices to validate)

- **Panel segmentation:** instance-segmentation transformer (Mask2Former or SAM-2 fine-tuned on vehicle panels). ~100M params. Runs server-side.
- **Damage classifier:** multi-label CNN or ViT-B, per-panel crop input. Quantized int8 copy runs on-device (tablet).
- **Severity head:** small regression head shared trunk with classifier.
- **Repair/replace decision:** gradient-boosted model on (damage_class, severity, panel, material, OEM rules). Not end-to-end CV — keep it auditable.
- **VIN decoder:** OCR (lightweight, on-device) + NHTSA vPIC.

Rationale for not going end-to-end neural on the repair/replace decision: we need an auditable reason string the estimator can challenge. Insurers and shops both push back on black-box decisions; an explicit rules + GBM layer gives us explainability at the exact point it matters.

### 6.3 On-device vs. server

- On-device (tablet): capture guidance, blur/glare rejection, VIN OCR, a quantized damage classifier for instant preview. Works offline.
- Server: panel segmentation, severity, operation decisioning, parts lookup, final estimate assembly. Cold-path latency target: P95 < 45 s per RO end-to-end.

### 6.4 Data strategy

This is the moat. Design decisions here are more important than model architecture. Because the assessor and the repairer are usually different entities, we need to be deliberate about which data loop closes where.

- **Training set v0 (seed):** public datasets (CarDD, VehiDE), licensed insurer data where available, and a commissioned labeling program on 50k photos across launch geographies.
- **Closed-loop ground truth (the moat):** comes from the **shop channel**. Every repair completed on Mecanix shop customers' own jobs feeds: photos, initial AI output, estimator edits, parts ordered, parts actually consumed, labor clocked, final invoice. This is the truth source that makes the model good. The insurer channel consumes the model but does **not** need to be the source of ground truth for it.
- **Loop closure for insurer-channel assessments:**
  - **Case A — vehicle is subsequently repaired at a Mecanix shop:** we can close the loop fully (assessment → actual repair data). This is a minority of cases but highest quality. No carrier data-sharing needed beyond the assessment itself.
  - **Case B — vehicle is repaired outside the Mecanix network:** we do **not** see the repair invoice. We close the loop via the carrier's `POST /assess/:id/outcome` callback, which reports the final settlement amount and optionally the sign-off repair-facility invoice. This is contractual per carrier; we offer a discount for carriers who opt in.
  - **Case C — vehicle is not repaired (total loss or declined):** we rely on the carrier's settlement decision as the label. Useful for calibrating the total-loss indicator.
- **Labeling:** dual-annotator with adjudication for v0. v1 onward uses repair / settlement outcome as label; no human re-labeling needed for most signals.
- **Consent and isolation:**
  - Shop-channel data is opt-in per shop, with customer consent language in the RO signature.
  - Insurer-channel data is governed by the carrier DPA; carrier A's claims never train against carrier B's corpus without explicit pooling consent.
  - Plates and VINs are hashed for training.
  - For T3 assessments, any photos or notes captured by the assessor belong to the insurer, not the assessor shop. The shop can see its own historical assessments but cannot use them to train a private model.
- **Retraining cadence:** monthly for the damage head, quarterly for segmentation. Per-carrier calibration layers (for pinned model versions) refresh on carrier request.
- **Eval set:** held-out, frozen, 5k claims per geography across shop and insurer channels. Never used for training. Re-scored on every model release. Public subset mirrors vendor-comparable tasks.

### 6.5 APIs

Two API surfaces. The core CV engine is shared; the contracts differ by audience.

**Shop API (internal-first, used by Mecanix UI)**
- `POST /aida/sessions` — create a capture session, returns capture token.
- `POST /aida/sessions/:id/media` — upload photo or video.
- `POST /aida/sessions/:id/submit` — trigger inference.
- `GET /aida/sessions/:id/estimate` — retrieve structured estimate.
- `POST /aida/sessions/:id/feedback` — estimator edits; diffed against AI output.
- Webhooks on `estimate.ready`, `estimate.low_confidence`, `flag.total_loss_suspected`.

**Carrier API (external, first-class in v1)**
- `POST /assess` — submit a claim for assessment. Body: claim ID, vehicle info, loss info, media URLs or direct upload, service tier.
- `GET /assess/:id` — retrieve assessment status and result.
- `POST /assess/:id/review` — carrier submits adjuster edits and final decision.
- `POST /assess/:id/outcome` — carrier reports settlement outcome (for model calibration, optional per contract).
- `GET /assess/:id/audit` — immutable audit trail: model version, inputs, outputs, timings, reviewer actions.
- `GET /assess/:id/evidence/:lineId` — evidence photo(s) with bounding boxes for a specific line.
- Webhooks on `assessment.ready`, `assessment.needs_review`, `assessment.escalated`.
- Authentication: OAuth 2.0 client credentials + mTLS for enterprise carriers.
- Rate limiting, per-tenant model versioning (carriers can pin a version for audit stability), per-tenant data isolation.

**Reviewer console (hosted web app)**
- Used by Mecanix reviewers (T2 service) and optionally by carrier adjusters who don't want to build their own UI.
- Queue, review, edit, approve, escalate to T3 physical inspection. Full evidence view. Keyboard-first for throughput.

Contracts for the two APIs live in one OpenAPI spec. Model code is shared; the difference is claim-context fields, SLA, rate limiting, tenant isolation, and audit guarantees.

### 6.6 Integrations

- **Parts catalogs:** OEC (CollisionLink / RepairLink), PartsTrader, regional equivalents for EU / LatAm.
- **VIN decode:** NHTSA vPIC (US), DVLA (UK), regional DMV-equivalents elsewhere; local cache.
- **Labor guides:** Motor, Mitchell, or equivalent per geography. Negotiated; not a dependency for v1 if we seed from OEM position statements + shop self-reported times.
- **OEM position statements:** ingested as structured rules for material-specific constraints (e.g., high-strength steel sections that cannot be sectioned).
- **Claims systems (carrier-side):** Guidewire ClaimCenter, Duck Creek Claims, Sapiens Claims — connectors that let a carrier submit to `/assess` and receive results without custom code. Launch with Guidewire in Phase 2; Duck Creek in Phase 3.
- **Policy & vehicle data providers:** LexisNexis, Verisk LightSpeed, equivalents per geography — for VIN-to-policy validation and prior-loss lookup, carrier-scoped.
- **Identity & compliance:** SOC 2 Type II (pre-GA for insurer channel), ISO 27001 (M12), GDPR / CCPA DPAs template-ready before first carrier signature.

---

## 7. UX flows

### 7.1 Advisor-guided tablet capture (primary flow)

1. Advisor taps **+ New RO**, scans VIN barcode or types plate.
2. System decodes VIN, displays vehicle card, asks advisor to confirm.
3. Advisor taps **AI Capture** → 8-shot guided sequence.
4. Each shot shows an on-screen ghost overlay (angle + distance target). Advisor cannot advance until the frame is acceptable (in-focus, glare OK, full panel in frame).
5. On shot 8, upload begins in the background; advisor continues intake with the customer.
6. Estimate is ready in ≤ 90 s; advisor receives a subtle notification.
7. Advisor reviews on-screen. Low-confidence lines are yellow. Advisor can tap any line to see evidence photos with bounding boxes.
8. Advisor approves or edits, then presents to customer.

### 7.2 Customer self-capture

1. Advisor (or booking flow) sends SMS/email link.
2. Customer opens browser; sees a short intro + 8-shot guided capture with the same overlays.
3. On submit, customer gets a "we'll review and get back to you within 30 minutes" message.
4. Shop receives AI estimate tagged `preliminary: true`; estimator reviews within the SLA and either sends a preliminary quote or asks the customer to bring the car in.

### 7.3 Walk-around video

1. Advisor holds the tablet and walks a continuous loop around the vehicle.
2. On-screen tracker shows which angles have been covered (gauge fills as coverage increases).
3. Upload auto-begins; estimate flow same as 7.1 but with multi-frame aggregation.

### 7.4 Insurer reviewer console (carrier-facing)

1. Carrier posts a claim to `/assess` (via connector or direct API). Media already collected via their FNOL app.
2. AIDA runs; results published to carrier webhook within tier SLA.
3. If tier is `ai_plus_mecanix_review`, the claim lands in the Mecanix reviewer queue, prioritized by SLA remaining and AI confidence.
4. Reviewer opens the claim, sees photos with AI-drawn bounding boxes, per-line reason strings, cost range, and the "suspected total loss" flag if applicable.
5. Reviewer can accept, edit any line, add a line, escalate to a senior reviewer, or request more photos from the carrier (which triggers a webhook back to them).
6. On approval, the full assessment is posted back to the carrier's system and a signed audit record is stored.
7. If the carrier later reports settlement outcome to `/assess/:id/outcome`, that outcome feeds the calibration pipeline.

### 7.5 Carrier adjuster flow (carrier-side review tier)

1. Claim hits the carrier's claims system (Guidewire, Duck Creek, etc.).
2. Connector invokes `/assess` with the appropriate tier.
3. Result comes back into the adjuster's claims-system inbox, surfaced as an AIDA assessment card with the same evidence and reason strings.
4. Adjuster accepts, edits, or rejects inside their own system; edits flow back to Mecanix via `POST /assess/:id/review`.

### 7.6 Physical inspection dispatch (T3) — assessor shop flow

1. Carrier submits claim to `/assess` with tier `t3_physical_inspection` and customer location.
2. AIDA runs a T1 pass and publishes a preview assessment to the carrier with `status: pending_physical_inspection`.
3. Mecanix dispatch service identifies nearest certified assessor shop by geography, availability, and vehicle type.
4. Assessor receives dispatch with claim context, customer contact, AI preview, and SLA clock (48 h typical).
5. Assessor contacts customer, schedules inspection at the shop or on-site.
6. Assessor uses Mecanix tablet to capture the full photo/video protocol (more angles, under-lift shots, paint-depth-gauge readings where applicable).
7. Assessor reviews AI-generated assessment on the tablet, makes edits with reason strings, and submits.
8. Assessor cryptographically signs the final assessment. System generates a signed PDF report.
9. Mecanix posts the final assessment and PDF back to the carrier via webhook. Claim moves to `status: final`.
10. Assessor is paid a fixed fee per completed assessment, visible in the assessor earnings view. Payment is from Mecanix to the assessor, not from the carrier to the shop, so the commercial relationship with the insurer stays with Mecanix.


---

## 8. Phased roadmap

The shop channel and the insurer channel run in parallel after Phase 1. The shop channel produces the data that makes the insurer channel credible; the insurer channel is where a large share of the revenue lives.

**Phase 0 — Foundations (M0–M3)**
- Data licensing, labeling vendor selection, public-dataset baselines.
- Capture SDK (tablet + web) with guided overlays.
- Panel segmentation v0 trained; public benchmark numbers published.
- Security & compliance work started: SOC 2 Type I audit kicked off, DPAs drafted.

**Phase 1 — Shop alpha (M3–M6)**
- 5 pilot shops across 2 geographies.
- Advisor-guided flow only; no video; no customer self-capture.
- Target: ≥ 80% panel accuracy, ≥ 60% operation match on our eval set.
- Begin carrier discovery: 6–10 insurer conversations, 1–2 design partners signed under NDA.

**Phase 2 — Shop beta + insurer T1/T2 design-partner alpha (M6–M9)**
- **Shop side:** 30 pilot shops across 3 geographies; customer self-capture added; parts catalog integration live. Target: ≥ 85% panel accuracy, ≥ 68% operation match, P95 latency ≤ 60 s.
- **Insurer side:** `/assess` API live in sandbox with 1–2 design-partner carriers. T1 (AI-only) and T2 (Mecanix remote reviewer) tiers live. Guidewire connector shipped. SOC 2 Type I complete.
- Assessor certification program designed; first 20 Mecanix shops enrolled as prospective T3 assessors.

**Phase 3 — Shop GA + insurer T1–T3 beta (M9–M12)**
- **Shop side:** General availability to all Mecanix Pro tier shops. Walk-around video added. Closed-loop retraining cadence running monthly. Targets: ≥ 90% panel accuracy, ≥ 72% operation match, touchless rate ≥ 70% on cosmetic/light-collision ROs, P95 latency ≤ 45 s.
- **Insurer side:** Paid carrier beta with 3–5 carriers in at least 2 geographies. T1, T2, and **T3 (physical inspection)** tiers live. Assessor network at 100+ shops across launch geographies. Dispatch service in production. SOC 2 Type II in audit window. Duck Creek connector shipped. Fraud / provenance signals in reviewer console.

**Phase 4 — Insurer GA + scale (M12–M18)**
- General availability of the insurer API under a published rate card.
- Mecanix human-review operations scaled (hiring, QA, SLA dashboards).
- Assessor network expanded to 500+ shops across launch geographies.
- Published industry benchmark page live with our numbers and open invitation to Tractable/CCC/Qapter/Inspektlabs.
- Sapiens connector and first non-English-first claims-system integration.
- Explore selling AIDA as **a software license to accredited-expert firms** (BCA Expertise, Cesvi, DEKRA, TÜV, etc.) as a separate motion — they remain the legal author of their statutory reports, Mecanix is the tooling. This is a partnership/licensing play, not a product tier.

**Phase 5 — Extensions (M18+)**
- Total-loss settlement math (carrier-specific calibration).
- Subrogation signals.
- Fleet / rental inspection productized as a third channel (competes with Inspektlabs).
- Cross-border assessor dispatch for carriers operating regionally.
- Shared anonymized benchmark data product (opt-in, revenue-share with carriers).

---

## 9. Metrics and success criteria

**Model metrics (reported weekly on frozen eval set)**
- Panel detection mAP.
- Damage classification macro-F1.
- Severity MAE.
- Operation-match rate (AI op vs. final RO op, per panel).
- Labor-hour MAE (AI vs. actual clocked, per RO).
- Parts precision/recall (AI parts list vs. actually consumed).
- **Total-cost MAE** (AI estimate vs. final shop invoice, for shop channel).
- **Settlement MAE** (AI assessment vs. carrier final settlement, for insurer channel).
- Repair-vs-total-loss decision accuracy at a published confidence threshold.
- Per-carrier and per-geography breakouts of all of the above (insurer channel requires this for contract reviews).

**Product metrics (reported weekly on live shops)**
- Time-to-first-estimate, median and P95.
- Estimator override rate per line type.
- Customer-facing cycle-time reduction vs. pre-AIDA baseline.
- Share of ROs where AIDA was used.
- Touchless rate: share of ROs approved without any line-level edit.

**Business metrics — shop channel**
- Pro-tier upgrade lift in shops with AIDA.
- NPS delta for shops with AIDA vs. without.
- Retention delta.

**Business metrics — insurer channel**
- Assessments processed per month, by carrier and tier.
- Revenue per assessment, blended and per tier.
- Gross margin per tier (AI-only should exceed 80%; human-review tier should exceed 40%).
- Carrier retention at 12 months; contract renewal value.
- SLA attainment: P95 latency per tier, reviewer-queue breach rate.
- Leakage metric: delta between AI cost estimate and final settlement, aggregated and by segment.
- Carrier NPS and escalation rate.

---

## 10. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model underperforms vendor baselines at GA | Medium | High | Publish methodology early; pick benchmark categories where our distribution shift and ground-truth data advantage are real; gate GA on internal eval bars, not a calendar date. |
| Shops don't opt in to data sharing, starving the insurer offering | Medium | **Critical** | Default opt-in on Pro tier with explicit revenue-share incentive; transparent dashboard showing how data is used; anonymization guarantees; opt-out doesn't degrade shop UX. |
| **Assessor independence is challenged (insurer or regulator accuses shop of inflating/deflating assessments)** | High | **Critical** | Assessor fee is **fixed per assessment**, never a percentage of the repair; assessor shop never sees the repair opportunity as contingent on the assessment; contract prohibits assessor from soliciting repair business off the assessment job; periodic blind audits where we re-assess a sample of T3 claims centrally and flag outliers; regulatory alignment per market. |
| Shops in the assessor network perceive Mecanix as cannibalizing their repair pipeline | Medium | High | Clear messaging: assessor work is **additional revenue**, not a replacement for repair; the assessor fee is paid regardless of repair outcome; shops retain the right to quote separately for repair; dashboards show assessor-network shops that their assessment jobs correlate positively (not negatively) with repair intake. |
| Carriers view Mecanix-network shops as biased | High | High | Assessments carry **no shop commercial pricing** and **no repair routing**; carrier can require blinded dispatch (carrier sees assessor identity only at report time, not during dispatch); carrier can blacklist specific shops from their assessments; independent audit and publishable bias metrics. |
| Parts catalog licensing delays | Medium | Medium | Negotiate OEC / PartsTrader / EU equivalents in parallel before M6; manual-catalog fallback for shops that use a local wholesaler. |
| **Regulatory — a carrier uses a Mecanix assessment in a context that legally requires an accredited expert** | Medium | High | Assessment reports explicitly state they are **financial assessments for claims handling**, not statutory expertise; carrier contracts disclaim use for legally reserved purposes; carrier is responsible for routing statutorily reserved claims through their accredited-expert network. |
| Legal / liability for AI-produced financial assessments | High | High | Every assessment labeled with model version and confidence; human-review tiers available; counsel review per geography; align with NAIC / EIOPA / FCA AI guidance; insurer contracts allocate liability per tier; T3 assessments are authored by the human assessor, not Mecanix. |
| Insurer procurement cycles are long | High | Medium | Design-partner track in Phase 2 to shorten time-to-first-revenue; target mid-market carriers first for faster cycles; land-and-expand inside enterprises. |
| Compute cost blows up with scale | Medium | Medium | On-device quantized model for the shop hot path; batched GPU inference for insurer API; tier pricing reflects cost structure. |
| Data isolation failure between carriers (critical trust issue) | Low | **Critical** | Hard tenant isolation from day one; per-carrier model versioning; regular third-party penetration testing; breach-notification runbook. |
| Assessor network quality drift (bad assessments slip through) | Medium | High | Certification curriculum with test; mandatory calibration jobs (re-assess known cases) every 90 days; shadow reviews by central Mecanix reviewers on 5% of all T3 assessments; poor-performer remediation or decertification. |
| OEM position-statement rules get stale | High | Low | Quarterly rules review; subscribe to I-CAR and OEM bulletins; version every rule with an effective date. |
| Incumbent vendors undercut on price to protect accounts | Medium | Medium | Lead with closed-loop accuracy story and physical-network differentiation, not price; bundle assessment with the shop value proposition; don't race to the bottom. |

---

## 11. Open questions

1. Do we ship v1 with paint-blend detection or push it to v2? It's hard and the data is sparse, but it's one of the highest-margin operations a shop books.
2. Do we build our own labor-guide product long-term, or stay dependent on Motor/Mitchell? Own it eventually, but v1 licenses.
3. **Shop pricing model** — per RO, flat Pro-tier uplift, or hybrid? Recommend flat uplift at launch (easier sell to shops, predictable cost), flip to hybrid once usage is mature.
4. **Insurer pricing model** — per assessment, tiered subscription with volume commits, or outcome-based (e.g., share of leakage reduction)? Likely per-assessment at launch with volume discounts, outcome-based pilots with 1–2 design partners for credibility. T3 priced meaningfully higher than T1/T2 to fund the assessor payout.
5. **Assessor economics** — what is the right split between Mecanix and the assessor shop for a T3 job? Proposal: fixed fee to the assessor (e.g., €60–€90 per assessment depending on complexity), Mecanix retains the difference between that and the carrier price. Must be competitive with what independent appraisers charge today in-market.
6. **Revenue share with shops whose (shop-channel) data trains the insurer product.** Do shops get paid when their shop-side repair data trains a model used to service insurers? Strongly recommend yes — aligns incentives, makes opt-in clean, great marketing story. Mechanism TBD (subscription credit, cash share, data co-op).
7. **Brand** — is the insurer-facing product sold under the Mecanix brand or a sub-brand (e.g., "Mecanix Assess")? Carriers may resist buying from a "body shop software company." Test in Phase 2 discovery.
8. **The "assessed-by-one-shop, repaired-by-another-shop, both-on-Mecanix" case.** This is the clean, expected case. Policy is that the assessment and the repair estimate are separate objects; the assessor shop does not see whether the repair was won by another Mecanix shop. Confirm with legal.
9. **Mandatory physical inspection thresholds per carrier** — carriers will want to configure "if AI confidence < X or cost > Y, auto-escalate to T3." Should be a first-class configuration, not a custom rule per carrier.
10. Carrier-pinned model versions vs. rapid retraining — how do we reconcile auditability with continuous improvement? Propose: carriers can pin versions; we maintain pinned versions for 24 months; `latest` channel for carriers who want continuous updates.
11. **Selling AIDA to accredited-expert firms as tooling** (Phase 4+) — is this a real product line or a distraction? Decide before committing go-to-market resources.
12. Do we eventually take direct consumer exposure (a B2C app for drivers)? Out of scope for this spec, but the capture SDK should be built such that a future B2C skin is feasible without a rewrite.

---

## 12. Appendix — Benchmark rubric we commit to publishing

A public page on mecanix.com/aida/benchmarks with:

- Exact datasets used (CarDD, VehiDE, our open subset).
- Exact metrics and how they are computed.
- Current Mecanix AIDA numbers, versioned by model release date.
- A reproducibility pack: eval script + model weights (or hosted inference endpoint) for the public subset.
- Invitation for Tractable, CCC, Qapter, Inspektlabs to publish on the same benchmark. We will host their numbers too, with attribution, if they do.

This is a reputational play as much as a technical one. The incumbent vendors have never had to publish reproducible numbers because no one made them. We become the one that did.
