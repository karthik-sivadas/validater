import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/migrations",
  // List schema files explicitly (not index.ts barrel) because drizzle-kit's
  // CJS loader cannot resolve NodeNext .js extension re-exports in barrel files.
  // Add new schema files here as they are created.
  schema: ["./src/schema/users.ts", "./src/schema/test-runs.ts", "./src/schema/api-keys.ts", "./src/schema/test-suites.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
