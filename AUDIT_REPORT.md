# Audit Report — Black Hole (Company Brain OS)

Audit date: 2026-10-12  
Repository: https://github.com/Anmol2k5/black-hole  
Branch: `main`; HEAD: `f33bcfacde28e80268fae1c9d713f923ea4f6521`  
Audit scope: GitHub source inspection plus available GitHub Actions metadata. **Not a completed local runtime audit.**

## 1. Summary

**Verdict: production readiness NOT demonstrated; demo readiness UNVERIFIED.** The repository contains a nontrivial Next.js application with ingestion, local SQLite storage, RAG, wiki views, a job worker, tests, and CI. It is more than an empty prototype. However, there is no defensible percentage of completion without executing the full workflow and validating product requirements.

The most serious identified concerns are: **the newest GitHub Actions run for this HEAD reports failure**, the application currently exposes local document-management endpoints without implemented authentication, the source-code UI has a non-responsive fixed-width sidebar, and the ingestion progress accounting is inconsistent.

The historical document `docs/current-system-audit.md` explicitly describes a *pre-hardening baseline*, NOT the checked-out HEAD. Do not copy its historical findings into current bug tickets without verifying them: the current source already has an asynchronous worker queue, upload validation, migrations, citation validation and a save-to-wiki endpoint.

Project map:
- UI: `src/app/{upload,sources,wiki,ask,jobs}`, shared `src/components/layout/{sidebar,header}.tsx`.
- HTTP APIs: `src/app/api/{upload,seed,sources,wiki,ask,jobs,answers}`.
- Ingestion: `src/lib/ingestion/pipeline.ts` -> `src/lib/jobs/queue.ts` -> `scripts/worker.ts`.
- Storage: `src/lib/db/client.ts`, migrations under `src/lib/db/migrations/`, raw local files.
- Knowledge synthesis: `src/lib/extraction/`, `src/lib/claims/`, `src/lib/wiki/`, `src/lib/query/engine.ts`.
- Declared dependencies/scripts: `package.json`; CI: `.github/workflows/ci.yml`.

## 2. Build/Run/Test Results

| Check | Outcome | Evidence |
|---|---|---|
| Local clone | **FAIL (environment)** | Executed `git clone --depth 1 https://github.com/Anmol2k5/black-hole.git black-hole`: `fatal: unable to access 'https://github.com/Anmol2k5/black-hole.git/': Could not resolve host: github.com`. |
| `npm ci` | **NOT EXECUTED** | Could not clone repository into runtime terminal. |
| `npm run build` | **NOT EXECUTED** | No local source checkout; do not infer success. |
| `npm run test` | **NOT EXECUTED** | Same limitation. |
| `npm run lint` | **NOT EXECUTED** | Same limitation. |
| `npm run typecheck` | **NOT EXECUTED** | Same limitation. |
| `npm run test:e2e` | **NOT EXECUTED** | Same limitation; needs service, worker and AI credentials. |
| GitHub Actions latest HEAD | **FAIL** | Workflow run [29428157507](https://github.com/Anmol2k5/black-hole/actions/runs/29428157507), commit `f33bcfa`, reports `conclusion: failure`. The available jobs API returned `total_count: 0`, so the failing step and error text are **not known**. |

Configured commands are visible in `package.json` lines 5–18. The workflow invokes install, lint, typecheck, tests, and build in `.github/workflows/ci.yml` lines 7–31. Its E2E job is conditional on `LLM_API_KEY` (`.github/workflows/ci.yml` lines 33–68); absence of credentials means **E2E skipped**, not passed.

The repository was retrieved for inspection via the connected GitHub API even though the separate terminal's DNS blocked cloning. This report does not claim to have run the application or visually inspected rendered pages.

## 3. Critical Issues (breaks core functionality / release)

- [ ] **CI red at HEAD** — `.github/workflows/ci.yml:7-31` — latest run 29428157507 failed. **Fix:** inspect its run summary/logs and reproduce the first failed command; require green CI before tagging a release. *Confirmed failure status; underlying cause unknown.*
- [ ] **Unauthenticated company-data access for any network-exposed deployment** — `src/app/api/wiki/route.ts:5-47`, `src/app/api/ask/route.ts:6-36`, `src/app/api/upload/route.ts:8-62` — handlers contain no request authentication or authorization checks. README explicitly lists auth/RBAC as future roadmap. **Fix:** either bind exclusively to localhost with explicit documented single-user threat model, or add session authentication and per-workspace authorization to every read/write route before exposing the server publicly. *Critical conditional on deployment exposure.*
- [ ] **Job progress denominator incorrect** — `src/lib/ingestion/pipeline.ts:32,61-62,105-171` — `TOTAL_STEPS = 6` but progress calls are only 1–5 before `markCompleted`. **Fix:** use five steps or explicitly record the sixth completed step, and test for monotonic progress and 100% completion.
- [ ] **Default production workflow depends on externally executed worker** — `src/lib/ingestion/pipeline.ts:44-50`, `scripts/worker.ts`, `package.json:16` — upload only enqueues; processing requires `npm run worker`. **Fix:** add a supervised worker service in deployment configuration and health checks; test the case where the worker is offline. *Architectural dependency, not proof of currently broken deployment.*

## 4. Broken / Non-Working Features

- [ ] `src/app/upload/page.tsx:29,150` — upload status lives entirely in component state; refreshing loses UI tracking of in-flight jobs. **Fix:** reload recent queued jobs/sources from API or persist job IDs and reconcile on mount.
- [ ] `src/app/upload/page.tsx:157-165`, `src/app/api/seed/route.ts:29-41`, `src/lib/ingestion/pipeline.ts:53-58` — demo loader UI claims seed ingestion/enqueue success, while server loops over files and uses deprecated `ingestFile` alias (which now enqueues). UI has no per-file result confirmation. **Fix:** report processed/skipped/errors and link to Jobs.
- [ ] `src/app/ask/page.tsx:23-38` — answer history only lives in component state. Reloading loses prior session answers even though `src/app/api/ask/route.ts:18-33` stores answers in DB. **Fix:** add a paginated answer-history GET endpoint and hydrate the view.
- [ ] `src/lib/query/engine.ts` near the comment `Wiki context removed to save context window` — the README advertises querying the compiled wiki, yet the answer engine explicitly omits wiki context in its prompt. **Fix:** clarify product semantics or reintroduce grounded wiki retrieval with tests. *Functional mismatch; chunk retrieval still works.*
- [ ] `README.md` near `Configurable LLM Support` and `src/lib/config.ts:10-21,49-56` — README headline says Anthropic supported; the environment section explicitly says direct Anthropic Messages API is not supported. **Fix:** advertise only actually supported OpenAI-compatible endpoints or implement and test native Anthropic support.
- [ ] `src/app/api/ask/route.ts:35` — obsolete `TODO: Implement saveToWiki logic` even though `src/app/ask/page.tsx:36-49` calls dedicated `/api/answers/[answerId]/save-to-wiki`. **Fix:** delete misleading TODO, document the new endpoint, and test the full button flow.

## 5. Hardcoded Values & Mock Data

- [ ] `src/lib/ingestion/pipeline.ts:32` — hardcoded six pipeline steps despite five displayed stages. Use a single typed step registry.
- [ ] `src/lib/ingestion/pipeline.ts:157,160,168` — literal org identifier `"default"` — should derive from an authorized workspace context before multi-tenant release.
- [ ] `src/lib/query/engine.ts` constants `RRF_K = 60`, `MAX_CHUNKS_PER_SOURCE = 3`, `TOP_CANDIDATES = 8` — legitimate retrieval defaults, but tune through evaluation/config if accuracy becomes a concern (not secrets).
- [ ] `src/app/ask/page.tsx:23-28` — four hardcoded suggested questions; make suggestions data-aware or identify as examples.
- [ ] `src/app/upload/page.tsx:72-75` — polling delay 1500ms; centralize polling interval and backoff.
- [ ] `src/components/layout/sidebar.tsx:12,15` — fixed `w-64` navigation width; responsive variant needed.
- [ ] `src/components/layout/sidebar.tsx` footer — hardcoded `MVP v0.1.0 © 2026`; derive version from release metadata.
- [ ] `seed/transcripts/*` and `evals/transcripts/*` — repository contains intentional synthetic demo/evaluation content; do not treat these as production user data.
- [ ] `README.md` startup instructions — `localhost:3000` is a legitimate development default, not evidence of a hardcoded production host.

**Limit:** a comprehensive recursive grep of every source line and dependency import could not be run locally. These are inspected examples, **not** a complete inventory. No committed live API key was identified in the reviewed files; this does not constitute a repository-wide secret scan.

## 6. TODO/FIXME Inventory

- [ ] `src/app/api/ask/route.ts:35` — `TODO: Implement saveToWiki logic (create synthesis page)`. Obsolete or misleading relative to dedicated endpoint.
- [ ] `src/lib/ingestion/pipeline.ts:53` — `@deprecated kept for compatibility`; identify callers (notably seed route) and remove after migration.

**Not exhaustive:** this section includes confirmed inspected lines, not every `TODO/FIXME/HACK/XXX` in the full repo. A complete grep is still required for the acceptance criteria.

## 7. Security & Config Issues

- [ ] **Public deployment would lack access control** — `src/app/api/wiki/route.ts:5-47`; `src/app/api/ask/route.ts:6-36`; `src/app/api/upload/route.ts:8-62`. Add authn/authz before external deployment.
- [ ] **Request memory bound** — `src/app/api/upload/route.ts:10,35-53` calls `req.formData()` then buffers each accepted file. Per-file validation does not cap the multipart body *before parsing*. Set request-size limits at the reverse proxy/runtime and consider streaming.
- [ ] **Raw error disclosure** — `src/app/api/ask/route.ts:39-44`, `src/app/api/upload/route.ts:59-64`: raw exception messages are returned to clients. Map failures to safe public error codes and log trace details server-side.
- [ ] **Development seed endpoint correctly gated** — `src/app/api/seed/route.ts:8-10` requires `ENABLE_SEED_ROUTE=true`; `src/lib/config.ts` also rejects the enabled seed route in production. Keep automated regression coverage.
- [x] **Environment/data ignore rules exist** — `.gitignore:24-49` excludes `.env*` except `.env.example`, `/data/`, `/.company-brain/`, SQLite files, and backups. This mitigates accidental future commits, but does not clean historical Git commits.
- [ ] **Configuration types not validated against runtime values** — `src/lib/config.ts:49-64` uses TypeScript casts on environment providers and `parseInt` for chunk sizes. Add Zod validation for enum and numeric bounds, including `chunkOverlap < maxChunkSize`.

## 8. UI/UX Issues & Fixes

These are source-based UX findings, **not browser-verified screenshots**.

- [ ] **Mobile sidebar likely overflows** — `src/app/layout.tsx:16-23`, `src/components/layout/sidebar.tsx:12-37`: permanent 256px sidebar, no breakpoint/toggle. **Fix:** use `hidden md:flex md:w-64` for desktop sidebar; add 44×44px mobile menu trigger and a 280px dismissible drawer; use 16px content padding on small screens and 24px on desktop.
- [ ] **Browser alerts replace integrated feedback** — `src/app/upload/page.tsx:162-165`, `src/app/ask/page.tsx:43-47,66-68`. **Fix:** accessible inline status / toast region with `role="status"`, optional retry, 4–6-second dismiss.
- [ ] **Upload UI cannot reject invalid files early** — `src/app/upload/page.tsx:155`: `useDropzone({ onDrop })` doesn't specify `accept`, `maxSize`, `maxFiles`. **Fix:** mirror `src/lib/uploads/policy.ts` restrictions in client config while retaining server validation.
- [ ] **Fixed viewport-height Q&A area can be cramped** — `src/app/ask/page.tsx` top-level `h-[calc(100vh-8rem)]`. **Fix:** flex `min-h-0` and responsive composer; check 320px, 375px, 768px, 1440px widths.
- [ ] **Hardcoded dark theme** — `src/app/layout.tsx:16` forces `className="dark"`. **Fix:** either explicitly brand dark-only and verify contrast or implement user theme preference.
- [ ] **No persistent answer history** — `src/app/ask/page.tsx:31`; hydrate saved answers and provide empty/loading/error states.
- [ ] **Static seeding success wording is potentially premature** — `src/app/upload/page.tsx:162`; show queued count, skipped count and a Jobs link.
- [ ] **Progress numbers misleading** — `src/lib/ingestion/pipeline.ts:32,61-62,165-171`; align stages and final 100%.

Suggested motion: 150–200ms hover/focus transitions, 200–250ms drawer slide, and reduced-motion support. **These are design recommendations, not measured rendering defects.**

## 9. Prioritized Fix Plan

| Priority | Item | Evidence | Effort |
|---|---|---|---|
| Critical | Diagnose and turn HEAD CI green | GitHub Actions run 29428157507; `.github/workflows/ci.yml:7-31` | Moderate / unknown until logs |
| Critical if public | Authenticate/authorize every company-data API route | `src/app/api/wiki/route.ts:5-47` etc. | Rework |
| High | Verify worker is deployed and supervised | `package.json:16`, `src/lib/ingestion/pipeline.ts:44-50` | Moderate |
| High | Correct progress-step counts | `src/lib/ingestion/pipeline.ts:32,61-62,165-171` | Quick |
| High | Add early request-body limits and safe errors | `src/app/api/upload/route.ts:10,35-64` | Moderate |
| High | Responsive app shell and mobile navigation | `src/app/layout.tsx:16-23`, `src/components/layout/sidebar.tsx:12-37` | Moderate |
| Medium | Persist upload/job UI recovery after refresh | `src/app/upload/page.tsx:29,150` | Moderate |
| Medium | Replace alert-based failures | `src/app/upload/page.tsx:162-165`, `src/app/ask/page.tsx:43-47` | Quick |
| Medium | Validate environment enums/chunk numeric bounds | `src/lib/config.ts:49-64` | Quick |
| Medium | Reconcile wiki-search behavior with README | `src/lib/query/engine.ts` wiki-context removal comment | Moderate |
| Low | Fix provider claims, stale baseline, obsolete TODO | `README.md`, `docs/current-system-audit.md`, `src/app/api/ask/route.ts:35` | Quick |
| Low | Replace demo-only prompt examples with contextual suggestions | `src/app/ask/page.tsx:23-28` | Quick |

## 10. Nice-to-haves

- Automated accessibility audit (axe), keyboard-only and reduced-motion checks.
- E2E tests with deterministic local/mock LLM responses so missing paid keys don't silently skip core UI coverage.
- Per-file ingestion retries, bulk job management, cancellation, and user-facing recovery.
- Retrieval quality dashboard over `evals/` and measured citation accuracy.
- Telemetry for queue age, failure counts, token costs and LLM latency.
- Deployment documentation covering data volume persistence, SQLite backup/restore, supervised worker startup, and local-only vs internet-facing modes.

## Audit limitations and follow-up commands

A full pre-launch sign-off **cannot** be issued from this evidence alone. The terminal's attempt to clone failed at DNS resolution, so I could not independently install dependencies, compile TypeScript, build Next.js, run Vitest/Playwright, launch a browser, or recursively search the full checkout for imports, comments and secrets.

On a machine with GitHub and npm network access run:

```bash
git clone https://github.com/Anmol2k5/black-hole.git
cd black-hole
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
git grep -n -Ei 'TODO|FIXME|HACK|XXX|mock|placeholder|localhost|127\.0\.0\.1|api[_-]?key|password|sk-' -- ':!package-lock.json'
git ls-files | grep -Ei '(^|/)(\.env|data|backups|.*\.(db|pem))'
```

Record each command's exit code and full log, run a real upload -> worker -> wiki -> ask -> save-to-wiki test, and attach browser screenshots for mobile and desktop. Update this report with those results before claiming demo or production readiness.

**Bottom line:** meaningful implementation exists, but the latest CI is red and runtime verification is incomplete. Neither a numerical completion percentage nor a successful build can be credibly asserted yet.
