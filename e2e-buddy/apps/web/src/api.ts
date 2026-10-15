import { HealthResponseSchema, type HealthResponse } from '@e2e-buddy/contracts';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`GET /api/health failed with ${res.status}`);
  }
  return HealthResponseSchema.parse(await res.json());
}
