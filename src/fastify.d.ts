import type { Registry } from 'prom-client';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    upstreamName: string;
  }
  interface FastifyInstance {
    metricsRegistry: Registry;
    keyReady: Promise<void>;
  }
}
