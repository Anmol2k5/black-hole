import { test, expect } from "@playwright/test";

/**
 * Smoke e2e flow (Phase 19 / 20). Exercises the core private-alpha journey:
 * upload a file, watch the job progress, open the generated wiki page, ask a
 * question, and inspect evidence. Requires a running server with configured
 * LLM credentials.
 */

test("upload a transcript, then ask a question with evidence", async ({ page }) => {
  await page.goto("/upload");
  await expect(
    page.getByText("Click or drag files here"),
  ).toBeVisible();

  // Upload a small transcript from the eval set.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("evals/transcripts/eval-acme.txt");

  await expect(
    page.getByText(
      /waiting for processing|processing|compiled|queued/i,
    ),
  ).toBeVisible();

  // Go to jobs and wait for completion.
  await page.goto("/jobs");
  await expect(
    page.getByText(/completed/i).first(),
  ).toBeVisible({ timeout: 120_000 });

  await expect(
    page.getByText(/failed/i),
  ).toHaveCount(0);

  // Ask a question.
  await page.goto("/ask");
  await page.getByPlaceholder(/ask|question/i).fill("Which feature is requested most?");
  await page.getByRole("button", { name: /submit question/i }).click();

  await expect(page.getByText(/evidence|source/i).first()).toBeVisible({ timeout: 60_000 });
});
