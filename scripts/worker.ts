/**
 * Standalone worker process.
 * Usage: npm run worker   (tsx scripts/worker.ts)
 *
 * Keeps polling the job queue until the process is terminated.
 */
import { startWorker, stopWorker } from "../src/lib/jobs/worker";

console.log("Starting Black Hole ingestion worker...");
startWorker(2000);

function shutdown() {
  console.log("Stopping worker...");
  stopWorker();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
