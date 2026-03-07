import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getSuiteDetail, runTestCase } from "@/server/test-suites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestCaseItem {
  id: string;
  suiteId: string;
  name: string;
  description: string;
  category: "happy_path" | "edge_case" | "error_state" | "boundary";
  priority: "critical" | "high" | "medium" | "low";
  reasoning: string | null;
  steps: object[] | null;
  testRunId: string | null;
  order: number;
  createdAt: Date;
}

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

interface SuiteDetailData {
  suite: SuiteItem;
  testCases: TestCaseItem[];
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_authed/suites/$suiteId")({
  loader: async ({ params }): Promise<SuiteDetailData> => {
    const detail = await getSuiteDetail({
      data: { suiteId: params.suiteId },
    });
    if (!detail) throw new Error("Suite not found");
    return detail as SuiteDetailData;
  },
  component: SuiteDetailPage,
});

// ---------------------------------------------------------------------------
// Category and priority styling
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  happy_path:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  edge_case:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  error_state:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  boundary:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  happy_path: "Happy Path",
  edge_case: "Edge Case",
  error_state: "Error State",
  boundary: "Boundary",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
      return "secondary";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SuiteDetailPage() {
  const loaderData = Route.useLoaderData() as SuiteDetailData;
  const { suite, testCases } = loaderData;
  const navigate = useNavigate();
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);

  // Group test cases by category
  const categories = ["happy_path", "edge_case", "error_state", "boundary"] as const;
  const grouped = categories
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      cases: testCases.filter((tc) => tc.category === cat),
    }))
    .filter((g) => g.cases.length > 0);

  async function handleRunTestCase(testCaseId: string) {
    setRunningCaseId(testCaseId);
    try {
      const result = await runTestCase({
        data: { testCaseId },
      });
      // Navigate to the test run results page
      navigate({
        to: "/runs/$runId",
        params: { runId: result.testRunId },
      });
    } catch (e) {
      // Reset running state on error
      setRunningCaseId(null);
      console.error("Failed to run test case:", e);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          to="/suites"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Suites
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Test Suite</h1>
          <Badge variant={statusVariant(suite.status)}>{suite.status}</Badge>
        </div>

        <a
          href={suite.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {suite.url}
        </a>

        <p className="text-sm text-muted-foreground">
          {suite.featureDescription}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {suite.testCaseCount} test case{suite.testCaseCount !== 1 ? "s" : ""}
          </span>
          <span>Created {dateFormatter.format(new Date(suite.createdAt))}</span>
        </div>
      </div>

      {/* Test cases by category */}
      {grouped.map((group) => (
        <div key={group.category} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[group.category]}`}
            >
              {group.label}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {group.cases.length} test{group.cases.length !== 1 ? "s" : ""}
            </span>
          </h2>

          {group.cases.map((tc) => (
            <TestCaseCard
              key={tc.id}
              testCase={tc}
              isRunning={runningCaseId === tc.id}
              onRun={() => handleRunTestCase(tc.id)}
            />
          ))}
        </div>
      ))}

      {testCases.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No test cases generated yet
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TestCaseCard
// ---------------------------------------------------------------------------

interface TestCaseCardProps {
  testCase: TestCaseItem;
  isRunning: boolean;
  onRun: () => void;
}

function TestCaseCard({ testCase, isRunning, onRun }: TestCaseCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              {testCase.name}
            </CardTitle>
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[testCase.priority]}`}
            >
              {testCase.priority}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {testCase.testRunId ? (
              <Link
                to="/runs/$runId"
                params={{ runId: testCase.testRunId }}
              >
                <Button variant="outline" size="sm">
                  View Results
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                disabled={isRunning}
                onClick={onRun}
              >
                {isRunning ? "Starting..." : "Run Test"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{testCase.description}</p>

        {testCase.reasoning && (
          <div className="mt-2">
            <button
              type="button"
              className="text-xs text-primary underline underline-offset-4 hover:text-primary/80"
              onClick={() => setShowReasoning(!showReasoning)}
            >
              {showReasoning ? "Hide reasoning" : "Show reasoning"}
            </button>
            {showReasoning && (
              <p className="mt-1 text-xs text-muted-foreground rounded-sm bg-muted p-2">
                {testCase.reasoning}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
