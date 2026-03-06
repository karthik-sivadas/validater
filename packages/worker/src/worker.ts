import { createRequire } from "node:module";
import { Worker } from "@temporalio/worker";
import { db } from "@validater/db";
import { shutdownPool } from "./browser/pool.js";

// Runtime activity imports (NOT workflow sandbox -- these run in Node.js)
import * as crawlActivities from "./activities/crawl-dom.activity.js";
import * as generateActivities from "./activities/generate-steps.activity.js";
import * as validateActivities from "./activities/validate-steps.activity.js";
import * as executeActivities from "./activities/execute-steps.activity.js";
import { createPersistActivities } from "./activities/persist-results.activity.js";

const require = createRequire(import.meta.url);

async function run() {
  const persistActivities = createPersistActivities(db);

  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows/test-run.workflow"),
    activities: {
      ...crawlActivities,
      ...generateActivities,
      ...validateActivities,
      ...executeActivities,
      ...persistActivities,
    },
    taskQueue: "test-pipeline",
  });

  console.log("Worker started on task queue: test-pipeline");

  // Graceful shutdown: drain browser pool on SIGINT/SIGTERM
  const shutdown = async () => {
    console.log("Shutting down worker...");
    await shutdownPool();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
