import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/suites")({
  component: SuitesLayout,
});

function SuitesLayout() {
  return <Outlet />;
}
