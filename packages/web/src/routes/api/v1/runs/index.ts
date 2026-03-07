import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/runs/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic imports to avoid bundling server-only deps in client
        const { verifyApiKey } = await import("@/lib/api-auth");
        const { z } = await import("zod");

        // Authenticate via API key
        const keyResult = await verifyApiKey(request);
        if (!keyResult.valid) {
          return Response.json(
            { error: keyResult.error },
            { status: 401 },
          );
        }

        // Parse and validate request body
        const CreateRunSchema = z.object({
          url: z.string().url(),
          testDescription: z.string().min(1).max(2000),
          viewports: z
            .array(z.string())
            .min(1)
            .max(10)
            .default(["desktop", "tablet", "mobile"]),
        });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 },
          );
        }

        const parsed = CreateRunSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid request body",
              details: parsed.error.flatten().fieldErrors,
            },
            { status: 400 },
          );
        }

        try {
          const { triggerTestRun } = await import("@/server/run-test-core");
          const result = await triggerTestRun({
            userId: keyResult.userId,
            url: parsed.data.url,
            testDescription: parsed.data.testDescription,
            viewports: parsed.data.viewports,
          });

          return Response.json(
            { testRunId: result.testRunId, status: "pending" },
            { status: 201 },
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Internal server error";

          // Surface validation errors (invalid viewports) as 400
          if (message.includes("No valid viewports found")) {
            return Response.json({ error: message }, { status: 400 });
          }

          console.error("[POST /api/v1/runs] Error:", err);
          return Response.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
