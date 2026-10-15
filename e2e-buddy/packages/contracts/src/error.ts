import { z } from 'zod';

/** Shared error body for every API error (spec §5). */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    detail: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
