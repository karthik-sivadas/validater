import { z } from 'zod';

export const SemanticElementSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    tag: z.string(),
    role: z.string().optional(),
    text: z.string().optional(),
    attributes: z.record(z.string()),
    children: z.array(SemanticElementSchema).optional(),
  })
);

export const InteractiveElementSchema = z.object({
  tag: z.string(),
  type: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  testId: z.string().optional(),
  text: z.string().optional(),
  value: z.string().optional(),
  attributes: z.record(z.string()),
  xpath: z.string(),
  cssSelector: z.string(),
});
