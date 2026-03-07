import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getSuiteList } from "@/server/test-suites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Search schema
// ---------------------------------------------------------------------------

const suiteSearchSchema = z.object({
  page: z.number().int().positive().catch(1),
  pageSize: z.number().int().positive().catch(10),
});

type SuiteSearch = z.infer<typeof suiteSearchSchema>;

// ---------------------------------------------------------------------------
// Suite item type
// ---------------------------------------------------------------------------

interface SuiteItem {
  id: string;
  userId: string;
  url: string;
  featureDescription: string;
  status: string;
  testCaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_authed/suites/")({
  validateSearch: zodValidator(suiteSearchSchema),
  loaderDeps: ({ search }: { search: SuiteSearch }) => search,
  loader: async ({ deps }: { deps: SuiteSearch }) => {
    const result = await getSuiteList({ data: deps });
    return result as unknown as {
      suites: SuiteItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  },
  component: SuiteListPage,
});

// ---------------------------------------------------------------------------
// Status badge variant
// ---------------------------------------------------------------------------

function statusVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "complete":
      return "default";
    case "failed":
      return "destructive";
    case "pending":
      return "outline";
    default:
      // generating, generating_specs, generating_steps, persisting
      return "secondary";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SuiteListPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch() as SuiteSearch;
  const navigate = useNavigate();

  function updateSearch(updates: Partial<SuiteSearch>) {
    const merged = { ...search, ...updates };
    navigate({
      to: "/suites",
      search: merged,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Suites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} suite{data.total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link to="/suites/new">
          <Button>Generate New Suite</Button>
        </Link>
      </div>

      {/* Suite cards */}
      {data.suites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">No test suites yet</p>
          <Link to="/suites/new">
            <Button variant="outline" size="sm">
              Generate your first suite
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.suites.map((suite: SuiteItem) => (
            <Card
              key={suite.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() =>
                navigate({
                  to: "/suites/$suiteId",
                  params: { suiteId: suite.id },
                })
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {truncate(suite.url, 60)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(suite.status)}>
                      {suite.status === "generating_specs" || suite.status === "generating_steps"
                        ? "generating"
                        : suite.status}
                    </Badge>
                    {(suite.status === "generating" ||
                      suite.status === "generating_specs" ||
                      suite.status === "generating_steps") && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        in progress
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {truncate(suite.featureDescription, 120)}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {suite.testCaseCount} test case{suite.testCaseCount !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {dateFormatter.format(new Date(suite.createdAt))}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={search.page <= 1}
              onClick={() => updateSearch({ page: search.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={search.page >= data.totalPages}
              onClick={() => updateSearch({ page: search.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
