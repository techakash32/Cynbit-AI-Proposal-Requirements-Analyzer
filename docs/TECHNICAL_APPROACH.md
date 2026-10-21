# Technical Approach

## Application boundaries

The React 19/Vite SPA owns route rendering, validation, tab/filter state, polling, chart presentation, optimistic editing, and file download interactions. TanStack Query owns server data and cache invalidation; Zustand stores only transient UI state; React Hook Form/Zod handles form validation. Tailwind CSS v4 and shadcn-compatible Radix primitives provide the token-based monochrome UI, while Lucide icons, Recharts and Framer Motion serve the specified visualizations and interactions.

FastAPI exposes cookie-authenticated JSON endpoints and upload processing. Pydantic v2 request and stage schemas validate API/LLM structures. Asyncpg uses parameterized SQL against Neon PostgreSQL. The numbered SQL migration `database/migrations/001_initial_schema.sql` defines the first persistent schema; it must be applied explicitly before first use. `database/schema.sql` is its current-schema snapshot; no migration runner applies changes at startup. The original uploaded bytes are parsed in the request; extracted text and page blocks are persisted, not the original file binary.

## Request and analysis data flow

1. The frontend sends same-origin `/api` requests. Vite proxies those paths to the backend during Preview/development. A Vercel build uses browser-safe `VITE_API_BASE` to reach the deployed API.
2. Signup/login use Argon2id password hashes and server-side sessions. The session is an HTTP-only cookie; a separate CSRF token is required for state-changing requests. Session records store token hashes, not raw session tokens.
3. The analysis endpoint validates the source, extracts text (PyMuPDF for PDF, python-docx for DOCX, UTF-8 replacement decoding for text), creates project/document/analysis records, then schedules staged processing.
4. Separate Groq stages produce requirements, gaps, risks, services, and proposal outline. Optional clarification questions and architecture use their own independent stages, which are not called when their switches are off. Architecture suggestions use Frontend, Backend, Database, AI/ML, Hosting, Auth, and Monitoring labels where relevant. Structured outputs are Pydantic validated; after two invalid-output attempts, the persisted asynchronous job fails and its status endpoint returns HTTP 422. Source evidence is preserved only if it is found literally in extracted source text; a page is attached only when the matching block provides one. Rule-based functions calculate complexity and estimates.
5. Each analysis status is persisted and returned to the UI’s two-second poll. The completed unified result and 17-section proposal are persisted. Proposal edits use PATCH; export endpoints generate Markdown, DOCX, or PDF.

## Security and correctness choices

- SQL queries use asyncpg positional parameters; route dependencies check resource ownership on read and mutation.
- API keys are server-side runtime values; never place Groq or Neon secrets in a Vite `VITE_*` variable or commit a populated `.env`.
- HTTPS deployment/Preview needs `Secure; SameSite=None` for the session cookie and exact CORS origins with credentials enabled. Local HTTP uses `PUBLIC_HTTPS=false`; set it to true only for public HTTPS Preview/hosting. Cross-site browser privacy policy can still block Vercel-to-Render cookies.
- Uploaded customer content is untrusted; the model prompt treats it as quoted source and must not follow instructions embedded in it. Only exact source matches may be cited.
- PyMuPDF extracts selectable PDF text; pages with fewer than 40 non-whitespace characters are rendered at 200 DPI and processed with local RapidOCR/ONNX Runtime, capped at 30 OCR pages and 20 megapixels per rendered page. Extraction runs in a worker thread. OCR accuracy has not been benchmarked and scans may be misread. Confidence or risk output is not a calibrated probability. Complexity is a deterministic rule score. Cost is total person-hours × hourly rate × contingency; sequential schedule is person-hours ÷ (team size × eight working hours/day). Edited estimate assumptions are client-side only and not persisted; results are conditional arithmetic, not a commercial quote.

## Runtime and failure behavior

Analysis tasks are currently created in the FastAPI process and are not backed by a durable job queue. The database stores their status, but an in-flight task is not automatically restarted if the process is interrupted. Provider, database, malformed-output, or export errors are surfaced as API errors or terminal analysis failures rather than successful output. A stable deployment should add a durable worker/queue and operational telemetry before handling production workload.

## Local and hosted configuration

Local setup is in the root README. The Vite dev server listens on port 3000 and proxies to port 8765. Render uses `backend/` as the service root and must receive `DATABASE_URL`, `GROQ_API_KEY`, exact `CORS_ORIGINS`, and `PUBLIC_HTTPS=true`. Vercel builds `frontend/dist` and needs a browser-visible API base ending in `/api`. These are templates; no hosting account or production instance is configured here.
