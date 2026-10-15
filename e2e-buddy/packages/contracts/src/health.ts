import { z } from 'zod';

/** `GET /api/health` response (spec §5.1). */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSec: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
