import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// createApiKeyFn -- create a new API key for the authenticated user
// ---------------------------------------------------------------------------

const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

/**
 * Create a new API key for the current user via Better Auth API Key plugin.
 *
 * Returns the full API key value (only shown once at creation time).
 * The key is hashed before storage -- the plaintext value cannot be
 * retrieved after this response.
 */
export const createApiKeyFn = createServerFn({ method: "POST" })
  .inputValidator(CreateApiKeyInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import(
      "@tanstack/react-start/server"
    );
    const { auth } = await import("@/lib/auth");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    const result = await auth.api.createApiKey({
      body: { name: data.name },
      headers,
    });

    return {
      id: result.id,
      key: result.key, // Full key value -- show once
      name: result.name,
      createdAt: result.createdAt,
    };
  });

// ---------------------------------------------------------------------------
// listApiKeysFn -- list all API keys for the authenticated user
// ---------------------------------------------------------------------------

/**
 * List all API keys for the current user.
 *
 * Returns key metadata (id, name, start, dates) but never the key value.
 */
export const listApiKeysFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequestHeaders } = await import(
      "@tanstack/react-start/server"
    );
    const { auth } = await import("@/lib/auth");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    const result = await auth.api.listApiKeys({ headers });

    // listApiKeys returns { apiKeys: [...], total, limit, offset }
    const apiKeys = result?.apiKeys ?? [];

    // Return safe subset -- never expose hashed key value
    return apiKeys.map((k) => ({
      id: k.id,
      name: k.name ?? "Unnamed",
      start: k.start ?? null,
      createdAt: k.createdAt.toISOString(),
      expiresAt: k.expiresAt?.toISOString() ?? null,
      lastRequest: k.lastRequest?.toISOString() ?? null,
      enabled: k.enabled,
    }));
  },
);

// ---------------------------------------------------------------------------
// revokeApiKeyFn -- revoke/delete an API key
// ---------------------------------------------------------------------------

const RevokeApiKeyInputSchema = z.object({
  keyId: z.string().min(1, "Key ID is required"),
});

/**
 * Revoke (delete) an API key by ID.
 *
 * Better Auth's deleteApiKey validates that the key belongs to the
 * authenticated user via session middleware.
 */
export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .inputValidator(RevokeApiKeyInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import(
      "@tanstack/react-start/server"
    );
    const { auth } = await import("@/lib/auth");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    await auth.api.deleteApiKey({
      body: { keyId: data.keyId },
      headers,
    });

    return { success: true };
  });
