/**
 * Server startup instrumentation (Next.js 16 convention).
 * Runs once when a new server instance starts. Used for production safety
 * checks (see validateRuntime).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRuntime } = await import("./lib/config");
    validateRuntime();

    // Start the in-process ingestion worker unless explicitly disabled.
    if ((process.env.WORKER_DISABLED ?? "false") !== "true") {
      const { startWorker } = await import("./lib/jobs/worker");
      startWorker(2000);
    }
  }
}
