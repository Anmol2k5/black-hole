# Manual Smoke Test

Run these checks by hand after a major change. Mark each box when it passes.
Automated equivalents will live in `tests/` and `evals/` (later phases).

## Prerequisites
- [ ] `npm install` completed
- [ ] `.env.local` created from `.env.example` with a valid `LLM_API_KEY`
- [ ] `npm run dev` started without errors
- [ ] `DATA_DIR` (default `./data`) is writable and is **outside** the git repo's
      tracked files (confirm with `git status` — no `data/` should appear)

## Startup
- [ ] App starts (`npm run dev` → ready on http://localhost:3000)
- [ ] No secrets logged to the console at startup
- [ ] Seed route is disabled when `ENABLE_SEED_ROUTE=false`

## Dashboard
- [ ] Dashboard loads at `/`
- [ ] No console errors in the browser

## Uploads
- [ ] TXT upload succeeds and a source appears
- [ ] PDF upload succeeds and a source appears
- [ ] Unsupported file type is rejected (415)
- [ ] Oversized file is rejected (413)
- [ ] Uploading the same file twice is handled as a duplicate (not a crash)

## Ingestion & Wiki
- [ ] Source appears in the list (`/sources`) with a status
- [ ] Wiki updates after processing (new/changed page)
- [ ] A nested wiki page such as `/wiki/product/requested-features` opens
- [ ] Wiki page renders without executing embedded HTML

## Query
- [ ] A question returns an answer
- [ ] Evidence links to a real source (opens the source)
- [ ] Each citation maps to an actual `sourceId` + `chunkId`
- [ ] An unknown evidence marker is rejected (server-side)

## Save to Wiki
- [ ] "Save to Wiki" either works fully (creates a synthesis page) or is not
      presented as functional

## Resilience
- [ ] Closing/refreshing the browser during processing does not lose the job
- [ ] A failed job can be retried
- [ ] Deleting a source recompiles affected wiki pages

## Backup / Restore
- [ ] Copying the single `DATA_DIR` folder backs up the complete workspace
- [ ] `npm run db:backup` produces a `backups/*.zip`
