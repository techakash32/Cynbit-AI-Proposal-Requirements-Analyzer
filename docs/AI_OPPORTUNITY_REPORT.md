# AI Opportunity Report — Requirements-to-Proposal Workbench

## Purpose and evidence boundary

This report describes an assessment-prototype opportunity for software-services proposal preparation. It is a product hypothesis, not a verified description of Cynbit Technologies’ internal workflow, client base, catalog, or measured business outcomes.

## Opportunity

Customer briefs often combine goals, features, constraints, integrations, and unresolved decisions in prose or documents. A services team may need to identify the atomic requirements, determine what remains unclear, surface delivery risks, discuss architecture and effort, and draft a proposal. A reviewable assistant could make that first pass faster and more consistent while keeping the original source visible.

## Proposed workflow

1. Accept a customer-provided brief and extract structured requirements with exact source snippets and page references when available.
2. Identify missing decisions and produce targeted business/technical clarification questions.
3. Assess risks and mitigations, then calculate a transparent deterministic complexity score.
4. Suggest service lines and architecture for human assessment; do not claim that a suggestion belongs to a verified Cynbit catalog.
5. Calculate preliminary effort/cost ranges from explicit phase hours and user-visible rate, contingency, and team-size assumptions.
6. Draft an editable proposal outline and export it only after a person reviews it.

## Potential value to evaluate

A future evaluation could measure time from brief intake to first human-reviewed draft, reviewer correction rates for extracted requirements, the proportion of requirements with valid source evidence, the usefulness of follow-up questions, and the number of unsupported claims caught before external sharing. These are suggested measures only; this prototype has no observed baseline or validated business-impact data.

## Stakeholders and controls

Potential users include proposal/delivery leads, business analysts, architects, and reviewers. Customers and delivery teams benefit only if a person checks the resulting scope. Uploaded documents are untrusted input; embedded instructions must not override system behavior. The interface preserves null evidence rather than inventing citations, labels estimates as preliminary, exposes assumptions, identifies service-catalog uncertainty, and directs reviewers to validate proposal claims.

## Risks and mitigations

- **Incomplete extraction:** show source snippets/pages, allow review, and describe OCR unavailability for scanned PDFs.
- **Unsupported model claims:** exact-match evidence grounding, explicit null behavior, bounded schema-validation retries, and visible proposal evidence warning.
- **Prompt injection:** delimit customer content as untrusted source material and instruct the model not to follow embedded commands.
- **Cost/scope misinterpretation:** show formulas and editable assumptions; never label an estimate as a quote.
- **Privacy and retention:** use account ownership checks and PostgreSQL persistence; disclose that extracted document text is stored, and restrict database access.
- **Provider or worker interruption:** surface a failed state; document that jobs are process-local and are not restored automatically after a restart.

## Responsible use

Do not use the prototype as an autonomous approval, contractual pricing, compliance assessment, or guarantee of project completeness. Review all extracted information, architecture, risk, service-line, cost, and proposal output before making a business decision. No real outcomes or accuracy figures are asserted in this report.
