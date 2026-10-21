# System Architecture

```mermaid
flowchart LR
  Person[Reviewer / services team]
  SPA[React 19 + Vite SPA\nforms, tables, charts, proposal editor]
  Proxy[Vite Preview proxy\n/api and /health]
  API[FastAPI\nAuth · projects · uploads · analyses · proposals]
  Extract[Document extraction\nPyMuPDF · python-docx · TXT]
  Pipeline[Required analysis stages\nPydantic validation · evidence grounding]
  Optional[Optional stages\nclarifications · architecture]
  Rules[Deterministic rules\ncomplexity · estimate arithmetic]
  Jobs[(Process-local async tasks\nnot a durable queue)]
  DB[(Neon PostgreSQL\nusers · sessions · projects · documents\nanalyses · proposals)]
  Groq[Groq OpenAI-compatible API\nopenai/gpt-oss-120b]
  Export[Export generation\nMarkdown · DOCX · PDF]
  Vercel[Vercel static frontend]
  Render[Render FastAPI service]

  Person --> SPA
  SPA --> Proxy --> API
  API --> DB
  API --> Extract --> DB
  API --> Jobs --> Pipeline
  Pipeline <--> Groq
  Pipeline --> Optional
  Optional <--> Groq
  Pipeline --> Rules
  Pipeline --> DB
  SPA --> API
  API --> Export --> SPA
  Vercel -. production static hosting .-> SPA
  Render -. production API hosting .-> API
```

## Boundaries

The browser stores transient UI state only; session identity is server-side and sent by an HTTP-only cookie. The external Groq provider receives the source text for requested analysis stages. Neon stores extracted document text and analysis outputs. Users should therefore treat Neon as containing customer-sensitive material and configure access/retention accordingly. No original binary object store or OCR service is part of this implementation.

Vercel and Render are documented deployment targets, not active deployments. Their separate-site origin relationship can interact with browser third-party-cookie restrictions. Analysis background work is process-local; persisted status does not make an in-flight task durable across restarts.
