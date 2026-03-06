import { useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getTestRunList } from "@/server/test-runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Search schema -- all filter/pagination state lives in URL search params
// Using z.catch() directly to avoid deep type instantiation from fallback()
// ---------------------------------------------------------------------------

const historySearchSchema = z.object({
  page: z.number().int().positive().catch(1),
  pageSize: z.number().int().positive().catch(20),
  status: z.enum(["pending", "complete", "failed", "all"]).catch("all"),
  search: z.string().optional().catch(undefined),
});

type HistorySearch = z.infer<typeof historySearchSchema>;

// ---------------------------------------------------------------------------
// Test run item type (matches getTestRunList return shape from drizzle schema)
// ---------------------------------------------------------------------------

interface TestRunItem {
  id: string;
  url: string;
  testDescription: string;
  status: string;
  viewports: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;
  userId: string;
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_authed/runs/")({
  validateSearch: zodValidator(historySearchSchema),
  loaderDeps: ({ search }: { search: HistorySearch }) => search,
  loader: async ({ deps }: { deps: HistorySearch }) => {
    const result = await getTestRunList({ data: deps });
    return result as unknown as {
      runs: TestRunItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  },
  component: TestHistoryPage,
});

// ---------------------------------------------------------------------------
// Status badge variant mapping
// ---------------------------------------------------------------------------

function statusVariant(
  status: string,
): "default" | "destructive" | "secondary" {
  switch (status) {
    case "complete":
      return "default";
    case "failed":
      return "destructive";
    default:
      // pending, crawling, generating, validating, executing, persisting
      return "secondary";
  }
}

// ---------------------------------------------------------------------------
// Date formatter (singleton)
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

// ---------------------------------------------------------------------------
// Truncation helper
// ---------------------------------------------------------------------------

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// ---------------------------------------------------------------------------
// TestHistoryPage component
// ---------------------------------------------------------------------------

function TestHistoryPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch() as HistorySearch;
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(search.search || "");

  // Navigate with merged search params (direct object, not reducer)
  function updateSearch(updates: Partial<HistorySearch>) {
    const merged = { ...search, ...updates };
    navigate({
      to: "/runs",
      search: merged,
    });
  }

  function handleSearchSubmit() {
    updateSearch({ search: searchInput || undefined, page: 1 });
  }

  const hasFilters =
    (search.search && search.search.length > 0) || search.status !== "all";

  function clearFilters() {
    setSearchInput("");
    updateSearch({ search: undefined, status: "all", page: 1 });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.total} test run{data.total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by URL..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearchSubmit();
          }}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={handleSearchSubmit}>
          Search
        </Button>

        <Select
          value={search.status || "all"}
          onValueChange={(val: string | null) => {
            if (val) {
              updateSearch({ status: val as HistorySearch["status"], page: 1 });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table or empty state */}
      {data.runs.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClearFilters={clearFilters} />
      ) : (
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Viewports</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.runs.map((run: TestRunItem) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({
                      to: "/runs/$runId",
                      params: { runId: run.id },
                    })
                  }
                >
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left">
                        {truncate(run.url, 50)}
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {run.url}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {truncate(run.testDescription, 60)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {run.viewports.join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(new Date(run.createdAt))}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/runs/$runId"
                      params={{ runId: run.id }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      )}

      {/* Pagination controls */}
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

// ---------------------------------------------------------------------------
// Empty state sub-component
// ---------------------------------------------------------------------------

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No test runs match your filters
        </p>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">No test runs yet</p>
      <Link to="/dashboard">
        <Button variant="outline" size="sm">
          Create your first test
        </Button>
      </Link>
    </div>
  );
}
