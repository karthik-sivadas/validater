import { z } from "zod";

export const appConfigSchema = z.object({
  appName: z.string(),
});
