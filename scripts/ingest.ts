/**
 * CLI d'ingestion — alternative au cron HTTP pour un run manuel/local :
 *   npm run ingest
 */
import { runIngestion } from "../lib/ingest";

runIngestion()
  .then((results) => {
    console.table(results);
    process.exit(results.every((r) => r.status === "ok") ? 0 : 1);
  })
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
