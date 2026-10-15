import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiErrorSchema, HealthResponseSchema } from '@e2e-buddy/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  it('GET /api/health returns a valid HealthResponse', async () => {
    const app = await buildApp({ version: '1.2.3' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.version).toBe('1.2.3');
    await app.close();
  });

  it('unknown /api routes return 404 in the shared error shape', async () => {
    const app = await buildApp({ version: '1.2.3' });
    const res = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe('NOT_FOUND');
    await app.close();
  });

  describe('with a built web app', () => {
    let webDistDir: string;

    beforeEach(async () => {
      webDistDir = await mkdtemp(join(tmpdir(), 'e2e-buddy-web-'));
      await mkdir(join(webDistDir, 'assets'));
      await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>E2E Buddy</title>');
      await writeFile(join(webDistDir, 'assets', 'app.js'), 'console.log(1);');
    });

    afterEach(async () => {
      await rm(webDistDir, { recursive: true, force: true });
    });

    it('serves static files and falls back to index.html for client routes', async () => {
      const app = await buildApp({ version: '1.2.3', webDistDir });

      const asset = await app.inject({ method: 'GET', url: '/assets/app.js' });
      expect(asset.statusCode).toBe(200);
      expect(asset.body).toBe('console.log(1);');

      const route = await app.inject({ method: 'GET', url: '/runs/abc' });
      expect(route.statusCode).toBe(200);
      expect(route.body).toContain('<title>E2E Buddy</title>');

      const api = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(api.statusCode).toBe(404);
      await app.close();
    });

    it.each(['/api', '/api?x=1', '/api/nope?x=1'])(
      'returns a JSON 404 for unknown API path %s, never index.html',
      async (url) => {
        const app = await buildApp({ version: '1.2.3', webDistDir });
        const res = await app.inject({ method: 'GET', url });

        expect(res.statusCode).toBe(404);
        expect(ApiErrorSchema.parse(res.json()).error.code).toBe('NOT_FOUND');
        await app.close();
      },
    );
  });
});
