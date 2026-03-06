import { createTemporalClient } from "./client.js";
import { parentGreetingWorkflow } from "./workflows/hello.workflow.js";

async function main() {
  const client = await createTemporalClient();

  // Execute parent workflow that spawns children
  const result = await client.workflow.execute(parentGreetingWorkflow, {
    args: [["Alice", "Bob", "Charlie"]],
    taskQueue: "hello-world",
    workflowId: `hello-parent-${Date.now()}`,
  });

  console.log("Parent workflow result:", result);
  // Expected: ["Hello, Alice!", "Hello, Bob!", "Hello, Charlie!"]

  if (result.length === 3 && result[0] === "Hello, Alice!") {
    console.log("SUCCESS: Parent-child workflow hierarchy works!");
  } else {
    console.error("FAILURE: Unexpected result");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
