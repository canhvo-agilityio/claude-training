import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import type { ApiError, HealthResponse } from '@e2e-buddy/contracts';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

export interface AppOptions {
  version: string;
  /** Built web app (`apps/web/dist`). Served only when the directory exists. */
  webDistDir?: string;
  logger?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.get('/api/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', version: options.version, uptimeSec: Math.round(process.uptime()) };
  });

  const serveWeb = options.webDistDir !== undefined && existsSync(options.webDistDir);
  if (serveWeb) {
    await app.register(fastifyStatic, { root: options.webDistDir });
  }

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '';
    const isApi = path === '/api' || path.startsWith('/api/');
    if (!isApi && request.method === 'GET' && serveWeb) {
      // Client-side routes fall back to the SPA entry point.
      return reply.sendFile('index.html');
    }
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    };
    return reply.code(404).send(body);
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (statusCode >= 500) request.log.error(error);
    const body: ApiError = {
      error: {
        code: error.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message: statusCode >= 500 ? 'Internal server error' : error.message,
      },
    };
    return reply.code(statusCode).send(body);
  });

  return app;
}
