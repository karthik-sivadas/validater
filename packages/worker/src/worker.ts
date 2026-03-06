import { createRequire } from "node:module";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities/hello.activity.js";

const require = createRequire(import.meta.url);

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows/hello.workflow"),
    activities,
    taskQueue: "hello-world",
  });
  console.log("Worker started on task queue: hello-world");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
