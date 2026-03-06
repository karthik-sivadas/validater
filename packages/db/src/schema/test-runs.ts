import { pgTable, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const testRunStatusEnum = pgEnum("test_run_status", [
  "pending",
  "crawling",
  "generating",
  "validating",
  "executing",
  "persisting",
  "complete",
  "failed",
]);

export const testRuns = pgTable("test_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  testDescription: text("test_description").notNull(),
  status: testRunStatusEnum("status").notNull().default("pending"),
  viewports: jsonb("viewports").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const testRunResults = pgTable("test_run_results", {
  id: text("id").primaryKey(),
  testRunId: text("test_run_id")
    .notNull()
    .references(() => testRuns.id, { onDelete: "cascade" }),
  viewport: text("viewport").notNull(),
  url: text("url").notNull(),
  totalDurationMs: integer("total_duration_ms").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const testRunSteps = pgTable("test_run_steps", {
  id: text("id").primaryKey(),
  resultId: text("result_id")
    .notNull()
    .references(() => testRunResults.id, { onDelete: "cascade" }),
  stepId: text("step_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  errorExpected: text("error_expected"),
  errorActual: text("error_actual"),
  screenshotBase64: text("screenshot_base64"),
  durationMs: integer("duration_ms").notNull(),
});
