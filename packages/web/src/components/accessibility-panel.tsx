import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessibilityViolation {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    target: string[];
    html: string;
    impact: string | null;
    failureSummary: string | undefined;
  }>;
  nodeCount: number;
}

interface AccessibilityData {
  violationCount: number;
  passCount: number;
  incompleteCount: number;
  inapplicableCount: number;
  violations: AccessibilityViolation[];
}

interface AccessibilityPanelProps {
  data: AccessibilityData | null;
}

// ---------------------------------------------------------------------------
// Impact color mapping
// ---------------------------------------------------------------------------

const IMPACT_STYLES: Record<string, string> = {
  critical:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  serious:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  moderate:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  minor:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

function impactStyle(impact: string | null): string {
  return (
    IMPACT_STYLES[impact ?? ""] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccessibilityPanel({ data }: AccessibilityPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  // Group violations by impact for summary
  const impactCounts: Record<string, number> = {};
  for (const v of data.violations) {
    const key = v.impact ?? "unknown";
    impactCounts[key] = (impactCounts[key] ?? 0) + 1;
  }

  const hasViolations = data.violationCount > 0;
  const showToggle = data.violations.length > 5;
  const displayedViolations =
    expanded || data.violations.length <= 5
      ? data.violations
      : data.violations.slice(0, 5);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Accessibility Insights
          {hasViolations ? (
            <Badge variant="destructive">
              {data.violationCount} violation{data.violationCount !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="default">No violations</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Summary badges */}
        <div className="flex flex-wrap items-center gap-2">
          {impactCounts.critical && impactCounts.critical > 0 && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${IMPACT_STYLES.critical}`}>
              {impactCounts.critical} critical
            </span>
          )}
          {impactCounts.serious && impactCounts.serious > 0 && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${IMPACT_STYLES.serious}`}>
              {impactCounts.serious} serious
            </span>
          )}
          {impactCounts.moderate && impactCounts.moderate > 0 && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${IMPACT_STYLES.moderate}`}>
              {impactCounts.moderate} moderate
            </span>
          )}
          {impactCounts.minor && impactCounts.minor > 0 && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${IMPACT_STYLES.minor}`}>
              {impactCounts.minor} minor
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {data.passCount} passed
          </span>
          {data.incompleteCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {data.incompleteCount} incomplete
            </span>
          )}
        </div>

        {/* Violations list */}
        {hasViolations && (
          <div className="flex flex-col gap-3">
            {displayedViolations.map((violation) => (
              <div
                key={violation.id}
                className="flex flex-col gap-1.5 rounded-sm border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${impactStyle(violation.impact)}`}
                  >
                    {violation.impact ?? "unknown"}
                  </span>
                  <span className="text-sm font-medium">{violation.help}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {violation.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{violation.nodeCount} affected element{violation.nodeCount !== 1 ? "s" : ""}</span>
                  <a
                    href={violation.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    Learn more
                  </a>
                </div>
              </div>
            ))}

            {showToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="self-start"
              >
                {expanded
                  ? "Show fewer"
                  : `Show ${data.violations.length - 5} more violation${data.violations.length - 5 !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
