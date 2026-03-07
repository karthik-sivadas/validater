import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Better Auth API Key plugin table.
 *
 * Table name is "apikey" (singular, no underscore) -- this is what the
 * @better-auth/api-key plugin expects (API_KEY_TABLE_NAME = "apikey").
 *
 * The schema matches the plugin's expected columns exactly. Better Auth
 * manages this table through its plugin system, but we define it in
 * Drizzle so drizzle-kit push is aware of it.
 */
export const apikey = pgTable("apikey", {
  id: text("id").primaryKey(),
  /** Configuration ID this key belongs to */
  configId: text("config_id").notNull().default("default"),
  /** User-provided name for the key */
  name: text("name"),
  /** First few characters of the key for display */
  start: text("start"),
  /** Owner reference (userId for user-scoped keys) */
  referenceId: text("reference_id").notNull(),
  /** Key prefix (e.g. "vld_") */
  prefix: text("prefix"),
  /** Hashed key value */
  key: text("key").notNull(),
  /** Refill interval in milliseconds */
  refillInterval: integer("refill_interval"),
  /** Amount to refill remaining count */
  refillAmount: integer("refill_amount"),
  /** Last refill timestamp */
  lastRefillAt: timestamp("last_refill_at"),
  /** Whether key is enabled */
  enabled: boolean("enabled").default(true),
  /** Whether rate limiting is enabled for this key */
  rateLimitEnabled: boolean("rate_limit_enabled").default(true),
  /** Rate limit time window in milliseconds */
  rateLimitTimeWindow: integer("rate_limit_time_window"),
  /** Max requests within the time window */
  rateLimitMax: integer("rate_limit_max"),
  /** Current request count within the window */
  requestCount: integer("request_count").default(0),
  /** Remaining requests before key is revoked (null = unlimited) */
  remaining: integer("remaining"),
  /** Last request timestamp */
  lastRequest: timestamp("last_request"),
  /** Key expiration timestamp */
  expiresAt: timestamp("expires_at"),
  /** Key creation timestamp */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** Key last update timestamp */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  /** JSON-encoded permissions */
  permissions: text("permissions"),
  /** JSON-encoded metadata */
  metadata: text("metadata"),
});
