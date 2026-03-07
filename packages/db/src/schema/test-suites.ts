import { pgTable, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { testRuns, testRunResults } from "./test-runs.js";

export const testCaseCategoryEnum = pgEnum("test_case_category", [
  "happy_path",
  "edge_case",
  "error_state",
  "boundary",
]);

export const testCasePriorityEnum = pgEnum("test_case_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const testSuites = pgTable("test_suites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  featureDescription: text("feature_description").notNull(),
  status: text("status").notNull().default("pending"),
  testCaseCount: integer("test_case_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const testCases = pgTable("test_cases", {
  id: text("id").primaryKey(),
  suiteId: text("suite_id")
    .notNull()
    .references(() => testSuites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: testCaseCategoryEnum("category").notNull(),
  priority: testCasePriorityEnum("priority").notNull(),
  reasoning: text("reasoning"),
  steps: jsonb("steps"),
  testRunId: text("test_run_id").references(() => testRuns.id, {
    onDelete: "set null",
  }),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accessibilityResults = pgTable("accessibility_results", {
  id: text("id").primaryKey(),
  resultId: text("result_id")
    .notNull()
    .references(() => testRunResults.id, { onDelete: "cascade" }),
  violationCount: integer("violation_count").notNull().default(0),
  passCount: integer("pass_count").notNull().default(0),
  incompleteCount: integer("incomplete_count").notNull().default(0),
  inapplicableCount: integer("inapplicable_count").notNull().default(0),
  violations: jsonb("violations").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
