/**
 * API key verification helper for server routes.
 *
 * Extracts bearer token from the Authorization header and validates
 * it via Better Auth's API Key plugin. Used by all API route handlers
 * in /api/v1/* endpoints.
 */

type VerifyResult =
  | { valid: true; userId: string }
  | { valid: false; error: string };

export async function verifyApiKey(request: Request): Promise<VerifyResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: "Invalid Authorization header format. Expected: Bearer <key>",
    };
  }

  const apiKeyValue = authHeader.slice(7); // Remove "Bearer "

  if (!apiKeyValue) {
    return { valid: false, error: "Empty API key" };
  }

  try {
    // Dynamic import to avoid circular deps and keep this usable from
    // server routes without pulling in the full auth module at import time
    const { auth } = await import("@/lib/auth");

    const result = await auth.api.verifyApiKey({
      body: { key: apiKeyValue },
    });

    if (!result || !result.valid) {
      const rawError = result?.error?.message;
      const errorMessage =
        typeof rawError === "string"
          ? rawError
          : "Invalid or expired API key";
      return { valid: false, error: errorMessage };
    }

    // The verified key has a referenceId which is the userId
    const key = result.key;
    if (!key) {
      return { valid: false, error: "API key verification returned no key data" };
    }
    return { valid: true, userId: key.referenceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "API key verification failed";
    return { valid: false, error: message };
  }
}
