# Current System Audit

> Baseline captured before the Phase 1–21 hardening work. Purpose: record the
> known state of the repository so later changes can be measured against it.
> Generated for the `fix/p0-security` / `develop` line.

## 1. Current routes

### Pages (App Router)
| Route | File | Notes |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Dashboard |
| `/upload` | `src/app/upload/page.tsx` | Upload UI ("Load Demo Data" seed) |
| `/sources` | `src/app/sources/page.tsx` | Source list |
| `/wiki` | `src/app/wiki/page.tsx` | Wiki index |
| `/wiki/[slug]` | `src/app/wiki/[slug]/page.tsx` | Wiki page viewer — treats `slug` as an **array** (`params.slug as string[]`), but the route segment is `[slug]` (single), not `[...slug]` (catch-all). Nested slugs like `product/requested-features` currently break. |
| `/ask` | `src/app/ask/page.tsx` | Q&A UI |
| `/jobs` | `src/app/jobs/page.tsx` | Job monitor |

### API route handlers
| Method | Route | File | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/upload` | `src/app/api/upload/route.ts` | Synchronous: reads whole file into memory, calls `ingestFile` inline. No size / extension / MIME / count validation. |
| `POST` | `/api/ask` | `src/app/api/ask/route.ts` | `saveToWiki` accepted but only a `TODO` — never implemented. Citations not validated server-side. |
| `GET` | `/api/wiki` | `src/app/api/wiki/route.ts` | `slug` query param not validated (path traversal / `..` not rejected). |
| `GET` | `/api/sources` | `src/app/api/sources/route.ts` | Source listing. |
| `GET` | `/api/jobs` | `src/app/api/jobs/route.ts` | Job listing. |
| `GET`/`POST` | `/api/seed` | `src/app/api/seed/route.ts` | Demo data loader. Should be disabled in production (`ENABLE_SEED_ROUTE`). |

## 2. Current tables

Defined in `src/lib/db/schema.ts` via a single `CREATE TABLE IF NOT EXISTS`
block (no migrations table). Tables:

- `sources` (`org_id`, `filename`, `original_name`, `file_path`, `file_type`,
  `source_type`, `category`, `status`, `extracted_text`, `metadata_json`,
  `summary`, …)
- `chunks` (`source_id`, `content`, `chunk_index`, `char_start`, `char_end`,
  `embedding_json`)
- `extractions` (`source_id UNIQUE`, `extraction_json`)
- `wiki_pages` (`slug UNIQUE`, `title`, `category`, `content_md`,
  `sources_json`, `confidence`, `is_generated`)
- `citations` (`wiki_page_id`, `source_id`, `chunk_id`, `claim_text`, `quote`,
  `source_title`, `source_date`)
- `jobs` (`source_id`, `job_type`, `status`, `current_step`, …)
- `answers` (`question`, `answer_text`, `evidence_json`, `confidence`,
  `gaps`, `suggested_action`, `saved_to_wiki`, `wiki_page_slug`)
- FTS5 virtual tables: `wiki_pages_fts`, `chunks_fts` (+ triggers)

### Schema limitations (targeted by later phases)
- `slug` is globally `UNIQUE`, not scoped by `org_id` → violates planned
  workspace isolation (Phase 16).
- No `schema_migrations` table → schema cannot evolve safely (Phase 4).
- No `observations` / `claims` / `claim_evidence` tables (Phase 10).
- No `checksum_sha256` on `sources` → no idempotent / duplicate detection
  (Phase 4 / 6.5).
- No `wiki_page_versions` history (Phase 11.5).
- No `audit_logs` (Phase 15.5).
- No `organizations` table (Phase 16.3).

## 3. Current environment variables

From `.env.example` (pre-hardening) and `src/lib/config.ts`:

- `LLM_PROVIDER` (`openai` | `anthropic` | `ollama`), default `openai`
- `LLM_MODEL` (default `gpt-4o-mini`)
- `LLM_API_KEY` (falls back to `OPENAI_API_KEY`)
- `LLM_BASE_URL`
- `EMBEDDING_PROVIDER` (`openai` | `ollama`)
- `EMBEDDING_MODEL`, `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`
- `COMPANY_NAME`
- `DATA_DIR` (default `./data`)
- `MAX_CHUNK_SIZE` (default `500`), `CHUNK_OVERLAP` (default `50`)

> DB path is **hardcoded** to `path.resolve(process.cwd(), ".company-brain")`
> in `src/lib/db/client.ts`, independent of `DATA_DIR` (Phase 3 issue).

## 4. Current upload formats

Handled by `src/lib/ingestion/text-extractor.ts` + `file-storage.ts`:

- `.txt`, `.md` — read as UTF-8 text
- `.pdf` — `pdf-parse` (called with an older function-style API; package is
  2.4.5, current API is `new PDFParse({ data })`)
- `.docx` — `mammoth`
- `.csv` — `papaparse` (currently flattened into one large string)
- `.json` — parsed
- transcripts (`.vtt`/`.srt`) — not formally supported yet (Phase 7.4)

No server-side validation of extension, size, MIME, or count (Phase 6).

## 5. Known broken flows

1. **Wiki one upload behind** — `wiki/compiler.ts` compiles
   `WHERE s.status = 'completed'`, but the source being processed is still in
   `compiling` while the compiler runs, so it is excluded (Phase 5.1).
2. **Nested wiki routing** — `product/requested-features` slugs 404 / error
   because the route is `[slug]` not `[...slug]` (Phase 5.2).
3. **"Save to Wiki" is a stub** — `POST /api/ask` has only a `TODO`; the UI
   control implies functionality that does not exist (Phase 5.3).
4. **Unvalidated `slug`** in `/api/wiki` (Phase 5.4).
5. **Unsafe uploads** — no size/type/count limits; whole file buffered in
   memory (Phase 6).
6. **PDF extraction API mismatch** + error text can be embedded as "content"
   (Phase 7.1, 7.2).
7. **Synchronous ingestion** — upload blocks until full pipeline (extraction,
   embeddings, LLM, wiki) completes; refresh kills the job (Phase 8).
8. **Document truncation** — extractor sends only first 15,000 chars to the LLM
   (Phase 9.1).
9. **Citations unverified** — answer engine lets the model supply source names
   / quotes and stores an empty `sourceId` (Phase 12).
10. **Raw HTML in wiki** — `rehype-raw` enabled (Phase 15.1).
11. **No migrations / data split** — DB under `.company-brain`, files under
    `DATA_DIR`; no upgrade path (Phase 3, 4).
12. **`.gitignore` lacks `data/` and `.company-brain/`** — real data could be
    committed (Phase 1.1).

## 6. Current test status

- No test framework installed (no `vitest`/`jest`).
- No `tests/` directory.
- No CI workflow (`.github/workflows`).
- Scripts present: `dev`, `build`, `start`, `lint` (`eslint`).
- `package.json` had no `typecheck`/`test` scripts (added in hardening).
- No evaluation dataset (`evals/`).

## 7. Current sample dataset

- `seed/` directory contains fake customer transcripts used by the demo seed
  route (10 transcripts).
- No controlled evaluation corpus yet (planned: `evals/`).

## 8. Framework notes

- **Next.js 16.2.10** (not 15 as the old README claimed). Per `AGENTS.md`,
  route handlers and pages follow Next 16 conventions: `params`/`searchParams`
  are **async** (`await ctx.params`) and must be read in server components /
  route handlers accordingly. Always consult `node_modules/next/dist/docs/`
  before editing framework code.
