import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import type { Metrics } from './metrics.js';

// Login e cadastro têm balde próprio (força bruta); o resto compartilha o balde global do IP.
const isAuthWrite = (req: FastifyRequest): boolean =>
  req.method === 'POST' && /^\/auth\/(login|register)(\?|$)/.test(req.url);

export async function registerRateLimit(
  app: FastifyInstance,
  config: Config,
  m: Metrics,
): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: (req) => (isAuthWrite(req) ? config.rateLimitAuthMax : config.rateLimitMax),
    timeWindow: config.rateLimitWindow,
    keyGenerator: (req) => `${isAuthWrite(req) ? 'auth' : 'global'}:${req.ip}`,
    errorResponseBuilder: (req) => {
      m.rateLimited.inc({ scope: isAuthWrite(req) ? 'auth' : 'global' });
      return Object.assign(new Error('limite de requisições excedido'), { statusCode: 429 });
    },
  });
}
