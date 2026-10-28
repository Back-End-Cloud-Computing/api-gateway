import replyFrom from '@fastify/reply-from';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import type { Registry } from 'prom-client';
import { Verifier, startKeyLoader } from './auth/jwt.js';
import type { Config } from './config.js';
import { registerCors } from './plugins/cors.js';
import { registerCorrelation } from './plugins/correlation.js';
import { createMetrics, registerMetrics } from './plugins/metrics.js';
import { registerRateLimit } from './plugins/ratelimit.js';
import { classifyUpstreamError } from './plugins/timeout.js';
import { findRoute } from './routes.js';

// forma mínima: o reply do reply-from e o do Fastify diferem só nos genéricos de servidor
interface Replier {
  code(status: number): { send(body: unknown): unknown };
  request: { correlationId: string };
}

const sendError = (reply: Replier, status: number, message: string) =>
  reply.code(status).send({ error: message, correlation_id: reply.request.correlationId });

// Bearer ou cookie accessToken (o shopping-cart aceita os dois)
function extractToken(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim() || undefined;
  const cookie = req.headers.cookie?.split(';').find((c) => c.trim().startsWith('accessToken='));
  return cookie?.split('=').slice(1).join('=').trim() || undefined;
}

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    // só o salto do Ingress (rede privada do cluster) pode informar o IP real via X-Forwarded-For
    trustProxy: '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    disableRequestLogging: true,
  });
  const metrics = createMetrics();
  const verifier = new Verifier(config.jwtIssuer);

  registerCorrelation(app);
  registerMetrics(app, metrics);
  await registerRateLimit(app, config, metrics);
  await registerCors(app, config);

  // corpo passa como fluxo, byte a byte, sem parse: o gateway não toca no payload
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_req, payload, done) => done(null, payload));
  await app.register(replyFrom);

  if (config.jwtPublicKey) {
    await verifier.setKey(config.jwtPublicKey);
    app.decorate('keyReady', Promise.resolve());
  } else {
    const loader = startKeyLoader(verifier, config.authBaseUrl, app.log);
    app.decorate('keyReady', loader.ready);
    app.addHook('onClose', async () => loader.stop());
  }

  app.setNotFoundHandler((_req, reply) => sendError(reply, 404, 'rota não encontrada'));
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'erro interno');
    return sendError(reply, status, status < 500 ? err.message : 'erro interno');
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_req, reply) =>
    verifier.ready ? { status: 'ready' } : sendError(reply, 503, 'chave pública indisponível'),
  );

  const proxy = async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split('?')[0] ?? '/';
    const route = findRoute(req.method, path);
    if (!route) return sendError(reply, 404, 'rota não encontrada');
    req.upstreamName = route.upstream;

    if (route.access === 'token') {
      if (!verifier.ready) return sendError(reply, 503, 'chave pública indisponível');
      const token = extractToken(req);
      if (!token) {
        metrics.authRejected.inc({ reason: 'missing' });
        return sendError(reply, 401, 'token ausente');
      }
      const result = await verifier.verify(token);
      if (!result.ok) {
        metrics.authRejected.inc({ reason: result.reason });
        return sendError(reply, 401, 'token inválido ou expirado');
      }
    }

    return reply.from(config.upstreams[route.upstream] + req.url, {
      timeout:
        req.method === 'POST' && path === '/products'
          ? config.productCreateTimeoutMs
          : config.upstreamTimeoutMs,
      rewriteRequestHeaders: (_r, headers) => {
        const out: Record<string, string | string[] | undefined> = {
          ...headers,
          'x-correlation-id': req.correlationId,
          'x-forwarded-for': req.ip,
        };
        delete out['x-internal-secret']; // nunca atravessa o gateway
        return out;
      },
      // php artisan serve devolve Host com o endereço interno (promotion:8000); não vaza pro cliente
      rewriteHeaders: (headers) => {
        const out = { ...headers };
        delete out.host;
        delete out['x-powered-by'];
        return out;
      },
      onError: (r, { error }) => {
        const failure = classifyUpstreamError(error);
        metrics.upstreamErrors.inc({ upstream: route.upstream, kind: failure.kind });
        return sendError(r, failure.status, failure.message);
      },
    });
  };
  // OPTIONS fica com o @fastify/cors, que já registra options('*'); sem CORS ligado ele cai no 404 acima.
  const methods = app.supportedMethods.filter((m) => m !== 'OPTIONS');
  app.route({ method: methods, url: '/*', handler: proxy });
  app.route({ method: methods, url: '/', handler: proxy });

  return app;
}

// /metrics vive em outra porta, que o Ingress não publica: só o Prometheus, de dentro do cluster, chega nela.
export function buildMetricsApp(registry: Registry): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/metrics', async (_req, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
  return app;
}
