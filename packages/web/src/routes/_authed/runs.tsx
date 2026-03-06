import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/runs")({
  component: RunsLayout,
});

function RunsLayout() {
  return <Outlet />;
}
