import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/runs")({
  component: RunsPage,
});

function RunsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Test Run History</h1>
      <p className="mt-2 text-muted-foreground">
        History page coming soon.
      </p>
    </div>
  );
}
