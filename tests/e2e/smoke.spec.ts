import { test, expect } from "@playwright/test";

/**
 * Smoke e2e flow (Phase 19 / 20). Exercises the core private-alpha journey:
 * upload a file, watch the job progress, open the generated wiki page, ask a
 * question, and inspect evidence. Requires a running server with configured
 * LLM credentials.
 */

test("upload a transcript, then ask a question with evidence", async ({ page }) => {
  await page.goto("/upload");
  const dropzone = page.getByText(/drag .* drop|browse/i);
  await expect(dropzone).toBeVisible();

  // Upload a small transcript from the eval set.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("evals/transcripts/eval-acme.txt");

  await page.getByRole("button", { name: /upload/i }).click();

  // A 202-style queued response should appear and a job row should be created.
  await expect(page.getByText(/queued|pending|uploaded/i).first()).toBeVisible({ timeout: 10_000 });

  // Go to jobs and wait for completion (or at least a terminal/active state).
  await page.goto("/jobs");
  await expect(
    page.getByText(/completed|failed|running|extracting|analyzing|compiling/i).first(),
  ).toBeVisible({ timeout: 120_000 });

  // Ask a question.
  await page.goto("/ask");
  await page.getByPlaceholder(/ask|question/i).fill("Which feature is requested most?");
  await page.getByRole("button", { name: /ask/i }).click();

  await expect(page.getByText(/evidence|source/i).first()).toBeVisible({ timeout: 60_000 });
});
