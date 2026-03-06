import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/runs/$runId")({
  component: RunDetailPage,
});

function RunDetailPage() {
  const { runId } = Route.useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Test Run Details</h1>
      <p className="mt-2 text-muted-foreground">
        Run detail page for {runId} coming soon.
      </p>
    </div>
  );
}
