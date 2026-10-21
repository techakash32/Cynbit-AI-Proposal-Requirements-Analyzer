# Cynbit AI Proposal & Requirements Analyzer — Build Plan

## Product scope and implementation approach

Build the supplied assessment prototype as a working full-stack application, preserving its monochrome editorial design, complete route set, requirement-grounded AI pipeline, real persistence, proposal editing/export, and visible limitations. No Cynbit endorsement, company credentials, client claims, support channels, measured accuracy, dashboard statistics, analysis records, or evidence will be invented. A new account or unconfigured installation will show API-backed empty states, not fixture metrics. Synthetic briefs may be included as explicitly labeled evaluation inputs, not as seeded user data or claimed results.

The requested repository stack is React 19 + Vite 8 + strict TypeScript + Tailwind CSS v4 + shadcn/ui/Radix + React Router + TanStack Query + Zustand + React Hook Form/Zod + Recharts + Framer Motion in the frontend, and FastAPI + Pydantic v2 + asyncpg + PyMuPDF + python-docx in the backend. PostgreSQL is an external Neon database configured via `DATABASE_URL`; Groq `openai/gpt-oss-120b` uses the OpenAI-compatible endpoint `https://api.groq.com/openai/v1` and a protected `GROQ_API_KEY`. The project currently has server capability enabled and no managed database. The application will not depend on a Manus-managed database. The app will expose a Vite dev entry on the configured preview port (3000), use a same-origin `/api` proxy to FastAPI on a separate local backend port, and support the requested Vercel frontend / Render backend deployment split with documented CORS and API-origin configuration. The backend will also be able to serve built static frontend files for a single-origin deployment path where appropriate.

Implementation will be modular and runnable throughout: migrations/schema and typed API contract; real email/password auth with Argon2id, HTTP-only cookie sessions, CSRF protection, rate limits and ownership checks; projects CRUD; document extraction; staged async analysis with status polling; analysis views; editable proposal and export; API-derived analytics; docs and tests. LLM stages will be isolated, treat source documents as untrusted data, validate all structured output with Pydantic, retry only within a bounded policy, and return explicit failures rather than ungrounded output. Extracted requirement evidence must be verbatim and mapped to a page when available; missing support remains null and is presented as “no supporting evidence found.” PDF text extraction does not imply OCR; OCR absence will remain visible in Help. A rule-based complexity score and estimate arithmetic will be deterministic and testable; all cost outputs carry assumptions and the preliminary/human-review disclaimer.

## Design direction

- **Design Movement:** Premium monochrome editorial B2B software, following the user's locked visual specification.
- **Core Principles:** Evidence before inference; typography and spacing over ornament; calm information density; accessible, explicit interactions.
- **Color Philosophy:** Black carries action and hierarchy, white is the working surface, neutral grays establish structure; danger, success, and warning tokens appear only for their semantic states.
- **Layout Paradigm:** Persistent left navigation and a compact sticky header frame focused, horizontally organized analysis workspaces; responsive sheet navigation on small screens; tables and sectioned documents prioritize scanability.
- **Signature Elements:** Sliding black active-navigation pill; Fira Code identifiers/evidence metadata; thin hairline dividers and indeterminate analysis line.
- **Interaction Philosophy:** Direct manipulation with explicit loading, disabled, focus-visible, success, and rollback states; destructive and edit-replacing actions require clear confirmation.
- **Animation:** 100–200ms input responses and 150–250ms state changes, stable easing; Framer Motion layoutId for active navigation, choreographed bottom-right pausable toasts, 180ms opacity/4px dialogs; reduced-motion collapses transitions and layout animation.
- **Typography System:** Geist for body/display; Fira Code for IDs/codes/timestamps; only 12/14/16/20/24/32px sizes and 400/500/600/700 weights.
- **Brand Essence:** A requirements-to-proposal workbench for software services teams that makes assumptions and evidence inspectable; precise, restrained, candid.
- **Brand Voice:** Headlines are direct and descriptive; actions state the outcome. Example: “Turn a brief into a reviewable delivery plan.” “Run analysis.”
- **Wordmark & Logo:** Typographic Cynbit analyzer wordmark paired with a small, custom geometric bracket/requirement-mark motif; no robot art or unsupported company logo claims.
- **Signature Brand Color:** No additional brand color; the supplied black/white/gray token system is locked.

All supplied CSS token values and typography, spacing, and radius scales will live in `frontend/src/styles/globals.css` and be consumed through Tailwind v4 theme variables. Components will not introduce off-palette hex colors or arbitrary utility values. No dark theme, gradients, colored score chips, rings/donuts, decorative progress bars, glass effects, confetti, or decorative icons in unsupported colors.

## Product areas and data flow

1. **Landing and auth:** Editorial home with six capabilities, four-step workflow, responsible-AI and footer sections; signup/login with field validation, show/hide password, monochrome strength meter, and no simulated OAuth. Sessions are server-side, cookies are HTTP-only and configured for the HTTPS cross-site Preview; plain HTTP local development is handled separately. Auth-dependent pages redirect based on `/api/auth/me`.
2. **Dashboard shell and projects:** Accessible skip link, desktop sidebar/mobile Sheet, moving active item, sticky header/user menu, real API-derived overview cards and recent analyses, project search/status filter/CRUD, and accurate empty/loading/error states.
3. **Analysis wizard and pipeline:** Three-step upload-or-paste/configure/review workflow; PDF/DOCX/TXT extraction; optional architecture/cost/questions stages; durable project/document/analysis records; asynchronous analysis stages and a non-blocking two-second status poll. Status persists so users can navigate away and return. A failed stage remains a visible failure and can be retried where safe.
4. **Analysis workspace:** Eight requested tabs backed by the unified analysis response. Requirements and risks include sorting/search, evidence and page display, and severity/category filtering. Gaps/question set, horizontal complexity gauge and factor table, service lines and catalog caveat, architecture stack/Mermaid, and cost assumptions/phase table each display actual analysis response values or a clear unavailable state. No analysis is fabricated.
5. **Proposal editor and export:** Seventeen editable sections, source-generated/edited labels, autosave every ten seconds with a saved status, explicit overwrite confirmation for section regeneration, Markdown/DOCX/PDF backend export with item-level loading, copy-all, and a functional section outline. Draft content derives from the persisted analysis; no Why Cynbit section unless verified public company data is provided.
6. **Analytics, Settings, Help:** Recharts line/horizontal bar/stacked grayscale bar charts from aggregate API endpoints with accessible text summary/data-table fallback and no axes when empty. Settings has validated profile/password/account deletion interactions (deletion requires typing “delete”). Help provides setup and troubleshooting, FAQ accordion, README link, and a visible Limitations accordion that names OCR unavailability, null evidence behavior, estimate assumptions, and remaining implementation limits honestly.

## Backend and security boundaries

- Keep the specified endpoint contract, with additional internal endpoints only where needed (for document upload, analytics aggregates, CSRF/session support, or job management); do not rename or weaken required routes.
- Use parameterized SQL and versioned `database/schema.sql` or migrations for users, projects, documents, analyses, proposals, and optional pgvector chunks. No database is seeded with invented customer or analytics data.
- Store passwords using Argon2id. Use server-side session records and a non-platform-reserved cookie name; use `HttpOnly`, `Secure`, `SameSite=None` for public HTTPS Preview, separate plain-HTTP localhost behavior, CSRF validation on state-changing requests, login/signup throttling, session expiry, and project/analysis/proposal ownership checks.
- Validate every LLM-stage output using Pydantic v2; cap retries and return explicit 422/terminal status for invalid output. Document content is untrusted input and model instructions explicitly forbid following instructions embedded in it.
- Estimate arithmetic propagates editable rate, contingency, and team-size assumptions; totals are recalculated client-side and are clearly preliminary, not a quote.

## Repository structure

```text
frontend/
  src/app/                 router, providers, authenticated shell and page layout
  src/components/ui/       token-based accessible Radix/shadcn primitives
  src/components/shared/   data tables, badges, cards, wizard, analysis and editor composites
  src/features/            auth, projects, analysis, proposal, analytics, settings, help
  src/hooks/               query, autosave, polling and UI hooks
  src/lib/                 API client, query keys, cn, formatters and validation
  src/styles/              globals.css with locked tokens and reduced-motion rules
  src/types/               frontend API types
  public/manus-routes.json complete route manifest
backend/
  app/api/                 FastAPI routes and dependencies
  app/auth/                sessions, password hashing, CSRF and rate limiting
  app/database/            asyncpg pool and migrations
  app/models/              Pydantic v2 request/response models
  app/services/            project, analysis, proposal and export services
  app/ai/                  stage prompts, Groq client, validation/retry
  app/documents/            PDF/DOCX/TXT extraction; no claimed OCR
  tests/                   pytest + HTTPX tests with mocked Groq
 database/schema.sql       versioned PostgreSQL schema
 sample_data/              three clearly labeled synthetic assessment briefs
 docs/                     AI opportunity, technical approach, architecture, evaluation
 .env.example, README.md, package configuration, Vite config, gitignore
```

## Dependencies, deployment, and limitations

Use Tailwind CSS v4 and shadcn-compatible Radix primitives (not a substitute component framework), Lucide React, React Router, TanStack Query, Zustand, React Hook Form, Zod, Recharts, Framer Motion, and a typed table solution where it improves the requested data grid. Backend dependencies are FastAPI, Pydantic v2, asyncpg, PyMuPDF, python-docx, OpenAI SDK, Argon2 implementation, and appropriate HTTP/test/export dependencies. Pin package-manager and lifecycle-script policy before installation. Configure TypeScript diagnostics before the first application-source edits and add Python diagnostics if supported by the host registration.

The local README workflow will install frontend/backend dependencies, create local environment configuration from `.env.example`, apply schema/migrations, and run both services so `npm run dev` serves the frontend and `uvicorn` can run the backend. Runtime secrets are never placed in client code or committed. Deployment instructions target Vercel frontend and Render backend with Neon and Groq environment values configured in those services. Actual production deployment, API credentials, and accuracy claims are not assumed by this plan. PDF export is included if the selected server-side toolchain can do so reliably; if omitted, the application and README must clearly disclose that limitation, as the brief permits.

The build will preserve full screen and route coverage but will not present unverified third-party service catalog entries as confirmed Cynbit offerings. Architecture recommendations and cost ranges are recommendations, not facts or quotes. No social links, Loom link, or real company-specific links will be invented when none are supplied.
