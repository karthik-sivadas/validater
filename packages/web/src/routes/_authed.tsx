import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { getSession } from "@/server/auth";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { user: session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    await navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-lg font-semibold tracking-tight"
            >
              Validater
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}
              >
                New Test
              </Link>
              <Link
                to="/runs"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}
              >
                History
              </Link>
              <Link
                to="/settings"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
