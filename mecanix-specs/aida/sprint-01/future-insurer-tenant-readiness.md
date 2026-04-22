# AIDA — Future Insurer-Tenant Readiness

**Status:** Forward-compat notes. Nothing in this doc is built now. Purpose is to prevent v1 design choices that would block selling Mecanix+AIDA to an insurer later.

**Posture (2026-04):** AIDA v1 ships inside Mecanix for workshops. Insurers may later sign up as a different kind of tenant for damage-assessment-as-a-service (the workshop keeps the shop identity inside the Mecanix UI; the insurer sees a neutral assessment). Legal + audit work (SOC 2, DPA, GDPR counsel) is deferred until an insurer actually signs. This doc keeps the software ready for that moment.

---

## 1. What makes the current schema mostly ready already

The `damage_assessments` table (migration 00089) is already tenant-scoped via the existing `tenant_id` + `get_tenant_id()` RLS. For an insurer to become a tenant, they just need rows in `tenants` + `users`. No second principal.

Also already shaped right:

- `job_card_id` is nullable — an insurer tenant creates assessments without job cards.
- `claim_id` (insurance_claims) is nullable — same.
- `vehicle_id` is required, but a lightweight vehicle row can be created from a VIN at assessment creation time.
- Photos, findings, operations, evidence (bboxes), confidence, `source` enum — all neutral of workshop semantics.

---

## 2. Two small additions to make in v1 (cheap now, painful later)

### 2.1 `tenants.tenant_type`

```sql
ALTER TABLE public.tenants
  ADD COLUMN tenant_type text NOT NULL DEFAULT 'workshop'
    CHECK (tenant_type IN ('workshop', 'insurer'));
```

- Default `'workshop'` preserves all existing behavior.
- No code branches on it in v1. The column just exists.
- When the first insurer onboards, we branch the handful of serializers that leak shop pricing / identity.

### 2.2 Serializer discipline

When writing v1 AIDA endpoints, keep three rules so we don't have to retrofit later:

1. The assessment **view object** (what the API returns) contains no fields derived from `job_cards`, shop-rate labour, or shop-catalog parts pricing. Those live on a separate `job_card` view object that the shop UI composes alongside.
2. Photo URLs returned by the assessment API point to the shared `aida-captures` bucket, not a workshop-specific path. (Already true.)
3. Nothing in the assessment payload identifies the capturing workshop by name. Workshop identity lives on the parent user/tenant, not on the row.

Following those rules in v1 means "insurer sees neutral output" costs zero later — it's just `tenant_type === 'insurer' ? skipShopFields(dto) : dto` in one place.

---

## 3. What we deliberately defer

Build only when an insurer is 30 days from signing:

- **Separate `assessments` table** for insurer-owned assessment objects with market-rate pricing. Until then, `damage_assessments` serves both.
- **`carriers` as a second principal** with `get_carrier_id()` JWT helper. Not needed if insurers come in as regular tenants via the existing auth.
- **Per-carrier model pinning.** No model lineage to pin; we use a hosted foundation model (Claude) that Anthropic versions for us.
- **`/assess` external API surface.** Until an insurer asks for machine-to-machine ingestion.
- **T2 Mecanix-reviewer queue + T3 physical-inspection dispatch.** Operational services, not software.
- **SOC 2 Type I/II observation window.** Start when procurement asks. It's ~6–9 months; that's fine if triggered on a real insurer contract.
- **DPA drafting with external counsel.** Start with the first serious insurer conversation.
- **Data-pooling consent toggles for cross-carrier training.** We're not training models. Moot.
- **Shop-identity stripping.** One flag in one serializer when needed.

---

## 4. Red lines for v1

Things we **must not** do in v1 that would corner us later:

- Do **not** denormalize workshop-rate labour cost into `damage_assessments` rows. Cost lives on `labour_lines` on the job card, computed at push-to-job time. An insurer tenant would never push to a job card.
- Do **not** hard-depend on `job_cards.id` from the AIDA controller. Guard every write with `if (assessment.job_card_id) { ... }`.
- Do **not** embed shop identity in generated PDF reports. If we add a report_url later, render it without the workshop name by default; workshop can be added as a header for the shop-channel version only.

---

## 5. When to revisit this doc

- First serious insurer conversation → turn items in §3 into a sprint.
- First insurer about to sign → apply `tenant_type` migration (§2.1), branch the serializer (§2.2), open legal + audit workstreams.

Until then, this doc is just a reminder of the few discipline points in §2 and §4.
