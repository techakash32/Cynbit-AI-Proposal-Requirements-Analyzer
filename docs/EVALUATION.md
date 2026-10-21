# Evaluation

## Scope

This assessment uses three synthetic briefs checked into `sample_data/`; they are not customer data or seeded application accounts. Their stated requirement-count ranges and expected gap/risk themes are evaluation expectations, not measured model results:

| Synthetic brief | Expected atomic requirements | Known gap themes | Representative risks |
| --- | ---: | --- | --- |
| AI customer support | 8–12 | Knowledge-base ownership/freshness; escalation SLA; PII retention; provider constraints; ticketing API limits; evaluation criteria | Unsupported/stale answers; prompt injection; privacy leakage; provider outage/latency; human-review bottlenecks |
| E-commerce integrations | 12–18 | Provider/sandbox ownership; webhook idempotency; retry policy; tax/refund edge cases; PCI boundary; inventory consistency; regional rollout | Third-party outage; duplicate webhooks; reconciliation errors; oversell; secret exposure; localization scope growth |
| Business analytics dashboard | 10–16 | Metric definitions; source ownership; refresh SLA; backfill; row-level permissions; export retention; reconciliation criteria | Metric disagreement; stale data; permission leakage; warehouse cost growth; misleading incomplete history |

## Automated checks

Backend tests use HTTPX and mocked Groq output for signup/duplicate/wrong-password/session expiry, cross-user access, CSRF-protected profile updates, Pydantic requirement validation, exact-evidence/null behavior, untrusted-source prompt delimiting, estimate arithmetic, and deterministic complexity examples. In-memory pipeline tests verify optional estimate/architecture/clarification behavior, unsupported evidence nulling, unverified service labeling, the exact 17-section outline, and failed invalid-provider output; a status-route contract verifies HTTP 422 for a persisted schema failure. These tests do not contact Neon or Groq.

Frontend Vitest tests cover API-response normalization, evidence/page preservation, disabled-estimate handling, and editable cost/schedule recalculation. The complexity tests use representative synthetic feature aggregates (10 requirements/2 high risks/1 integration; 15/4/5; 13/2 medium/3) and expect deterministic scores `32`, `66`, and `40`. These values validate the rule function, not Groq model accuracy on the full sample briefs.

## Recorded run (2026-10-21)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed; frontend TypeScript and repository Pyright, 0 errors, 0 warnings, 0 information. |
| `pnpm test:all` | Passed; Vitest 5 tests and Pytest 15 tests. |
| `pnpm build` | Passed. Vite retained a chunk-size advisory: `index` 744.34 kB, deferred Mermaid/ELK chunk 1,462.93 kB, and Analytics page 342.18 kB (uncompressed). The diagram is deferred until needed, but the heavy optional vendor chunks remain. |
| Preview HTTP checks | `GET /`, `/health`, `/manus-routes.json`, `/help`, and `/README.md` returned 200. The static route manifest was valid JSON with 14 routes. API health reported `database_configured: true` and `groq_configured: true`; this is configuration status, not a real-provider quality evaluation. No account or user-data mutation was performed for these checks. |
| Public UI review | Landing, signup, and Help pages were opened in Preview. Clean landing/signup captures are included in `docs/screenshots/`; no signup data was entered or submitted. |

## Results and limitations

No blinded human-labeled dataset, baseline, inter-rater review, latency study, cost study, or real-world task-time measurement is included. Therefore no extraction precision/recall, risk accuracy, proposal quality, productivity improvement, or provider reliability is claimed. Tests validate contracts and deterministic logic only; Groq responses were mocked, and real model output quality was not measured. OCR, durable background-job recovery, and external deployment are not evaluated here. A complete signed-in, real-database user journey was not run to avoid creating persistent test accounts/data. A formal WCAG 2.2 AA keyboard and assistive-technology audit remains open; accessible primitives, semantic markup and focus styling are implemented, but conformance is not claimed. The bundle-size advisory above is retained rather than hidden by changing the warning threshold.
