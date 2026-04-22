# Archived Specs

Specs in this directory are **no longer the source of truth** for active work. They describe earlier product thinking that has been superseded by the current AIDA-v1 plan in `mecanix-specs/aida/sprint-01/` and the enhancements audit in module 18.

## Why these are here

Both `21-mecanix-ai-damage-assessment-spec.md` and `22-aida-sprint-plan-phase-0-1.md` were written as if Mecanix were building a **two-sided insurer-facing product** with a custom-trained CV model, SOC 2 observation, a labeling vendor program, and a 12-sprint Phase 0/1 plan. We explicitly pivoted on 2026-04-22:

- AIDA v1 is a **module inside Mecanix**, not a standalone company-facing product.
- It is powered by a **hosted foundation model (Claude Opus 4.7 vision)**, not a trained CV pipeline — so no labeling, no GPU infra, no model training.
- Insurers may later sign up as a different kind of Mecanix tenant, but that work is deferred until a real insurer contract is close. Forward-compat notes live at `mecanix-specs/aida/sprint-01/future-insurer-tenant-readiness.md`.

## Do not drive new work from these files

They remain on disk for historical context only. The v1 plan that was actually built is in `mecanix-specs/aida/sprint-01/`.
