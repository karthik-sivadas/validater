import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL || "http://localhost:3000",
  plugins: [apiKeyClient()],
});
