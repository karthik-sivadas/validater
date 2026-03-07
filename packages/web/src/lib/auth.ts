import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { apiKey } from "@better-auth/api-key";
import { db } from "@validater/db";
import * as schema from "@validater/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    apiKey({
      defaultPrefix: "vld_",
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000, // 60 seconds in milliseconds
        maxRequests: 60, // 60 requests per window
      },
    }),
    tanstackStartCookies(), // MUST be last plugin
  ],
});
