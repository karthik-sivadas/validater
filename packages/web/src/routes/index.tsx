import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Validater</h1>
        <p className="text-sm text-muted-foreground">
          AI-powered web testing
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          to="/login"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Log in
        </Link>
        <Link to="/signup" className={cn(buttonVariants())}>
          Sign up
        </Link>
      </div>
    </div>
  );
}
