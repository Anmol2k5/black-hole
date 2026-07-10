/**
 * Trigger the demo seed via the running app's API.
 * Requires the dev/prod server to be up (npm run dev).
 *
 * Usage: npm run seed
 */
const base = process.env.APP_URL || "http://localhost:3000";

fetch(`${base}/api/seed`, { method: "POST" })
  .then(async (res) => {
    const text = await res.text();
    console.log(`Seed responded ${res.status}: ${text}`);
    if (!res.ok) process.exit(1);
  })
  .catch((err) => {
    console.error(
      "Seed request failed. Is the server running? (npm run dev)",
      err,
    );
    process.exit(1);
  });
