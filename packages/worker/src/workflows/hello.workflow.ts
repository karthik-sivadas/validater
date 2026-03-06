import { proxyActivities, executeChild } from "@temporalio/workflow";
import type * as activities from "../activities/hello.activity.js";

const { greet } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

// Child workflow: greets a single person
export async function greetingWorkflow(name: string): Promise<string> {
  return await greet(name);
}

// Parent workflow: spawns child workflows for each name, aggregates results
export async function parentGreetingWorkflow(
  names: string[],
): Promise<string[]> {
  const results = await Promise.all(
    names.map((name) =>
      executeChild(greetingWorkflow, {
        args: [name],
        workflowId: `greeting-${name}-${Date.now()}`,
      }),
    ),
  );
  return results;
}
