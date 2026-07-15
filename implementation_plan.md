# Fix P0 Critical Issues in Black Hole

This implementation plan addresses the 12 P0 critical issues identified in the repository audit to make the core ingestion, clustering, and wiki compilation process reliable.

## User Review Required

Please review the proposed database schema changes for `claims` (adding a `claim_snapshots` table or handling upserts) and the changes to the upload UI polling mechanism. Let me know if these align with your expectations.

## Proposed Changes

---

### UI State and Polling

#### [MODIFY] [src/app/upload/page.tsx](file:///d:/BLACKHOLE/company-brain/src/app/upload/page.tsx)
- Update `processFile` to immediately mark the upload as `queued` or `Wait...` after a successful `202 Accepted` response from `/api/upload`.
- Implement a polling mechanism (e.g., using `setInterval`) to ping `/api/jobs` and filter for jobs associated with the current file.
- Update the UI status based on the job's `status` (queued, processing, completed, failed) and `progress_percent`.
- Only set the status to `completed` and show the green icon when the job's status is `completed`.

---

### Route Protection

#### [MODIFY] [src/app/api/seed/route.ts](file:///d:/BLACKHOLE/company-brain/src/app/api/seed/route.ts)
- Add a check at the beginning of the POST handler:
  ```typescript
  if (process.env.ENABLE_SEED_ROUTE !== "true") {
    return NextResponse.json({ error: "Seed route is disabled." }, { status: 404 });
  }
  ```

---

### Wiki Compilation

#### [MODIFY] [src/lib/wiki/compiler-v2.ts](file:///d:/BLACKHOLE/company-brain/src/lib/wiki/compiler-v2.ts)
- Update `compileWikiFromClaims` to persist the generated markdown content to the file system at `data/wiki/<slug>.md`.
- In `updateIndexPage`, change the output directory for `index.md` from `getRawDirectory()` to `getWikiDirectory()`.
- Create a `persistWikiPage` helper to ensure directories are recursively created before writing the file.

#### [MODIFY] [src/lib/wiki/renderer.ts](file:///d:/BLACKHOLE/company-brain/src/lib/wiki/renderer.ts)
- Remove the hardcoded `.sort((a, b) => b.uniqueSourceCount - a.uniqueSourceCount)` in `renderClaimPage`. The claims are already sorted by `compileWikiFromClaims` according to the page definition configuration.
- Implement the `minimumEvidence` filter on claims before rendering if it exists in the definition.

---

### Observations and Claims Mapping

#### [MODIFY] [src/lib/extraction/chunk-extractor.ts](file:///d:/BLACKHOLE/company-brain/src/lib/extraction/chunk-extractor.ts)
- When iterating through extracted observations, if an observation includes a `quote`, calculate its local offset within the `segmentText`. 
- Refine `charStart` to be `segment.charStart + localOffset` so that the observation correctly links to the retrieval chunk that contains the actual quote.

#### [MODIFY] [src/lib/claims/repository.ts](file:///d:/BLACKHOLE/company-brain/src/lib/claims/repository.ts)
- Update `rebuildClaims` to preserve existing claim history.
- Instead of deleting all claims (`DELETE FROM claims`), use `INSERT OR IGNORE` or `ON CONFLICT` updates to update `mention_count`, `unique_source_count`, `confidence`, and `last_seen_at` while preserving `first_seen_at`.
- Refactor the evidence linking logic: Instead of using `text` and `type` matching (which fails for duplicate observations with identical text), attach the original database `id` to the `Observation` objects passed to `clusterObservations`. Use this exact ID when inserting into `claim_evidence`.

#### [MODIFY] [src/lib/claims/clusterer.ts](file:///d:/BLACKHOLE/company-brain/src/lib/claims/clusterer.ts)
- Update `clusterObservations` and the `Observation` interface slightly (or pass wrappers) to preserve the `observationId` throughout clustering, ensuring multiple identical observations are correctly linked as distinct pieces of evidence.

---

### Citation Integrity

#### [MODIFY] [src/lib/query/engine.ts](file:///d:/BLACKHOLE/company-brain/src/lib/query/engine.ts)
- Implement `extractInlineEvidenceIds` using a regex (e.g., `/\[(E\d+)\]/g`) to parse markers from `parsed.answer`.
- Consolidate `parsed.evidenceIds` and inline markers into a unique set of `proposedIds`.
- After calling `validateEvidenceIds`, remove or reject any inline markers from the answer text that are in the `invalid` array to ensure models don't inject unverified references.
- Fix confidence scoring: `RRF_K` makes the average score artificially low (~0.01 - 0.05). Normalize the `avgScore` using the highest retrieved score (`maxRrf`) so that high confidence is reachable.
- When retrieving context from wiki pages, ensure that we only extract claims, then retrieve the backing chunks, OR require the model to explicitly cite chunk-backed evidence. Do not append wiki context unconditionally without evidence markers.

---

### Taxonomy Migration

#### [MODIFY] [src/lib/wiki/definitions.ts](file:///d:/BLACKHOLE/company-brain/src/lib/wiki/definitions.ts) (or relevant citation router)
- Delete legacy citation taxonomies that map observations to outdated slugs like `strategy/customer-pain-points`.
- Ensure all claims resolve properly through the new paths defined in `compiler-v2`.

## Verification Plan

### Automated Tests
- Run integration tests for extraction and compilation (`npm run test` if available).
- Add tests to ensure `index.md` goes to `data/wiki/` instead of `data/raw/`.

### Manual Verification
- Test the upload page by dropping a file and watching it stay in "Wait..." or "Processing..." state until the job is actually complete.
- Verify `data/wiki` directory is populated with markdown files.
- Test a query with the LLM to verify that invalid evidence markers like `[E999]` are scrubbed from the answer.
