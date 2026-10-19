import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface Metrics {
  registry: Registry;
  requests: Counter<'upstream' | 'method' | 'status'>;
  duration: Histogram<'upstream'>;
  authRejected: Counter<'reason'>;
  rateLimited: Counter<'scope'>;
  upstreamErrors: Counter<'upstream' | 'kind'>;
}

// O rótulo upstream vem da tabela de rotas ("none" se nenhuma casou), nunca do caminho cru:
// caminho como rótulo explode a cardinalidade no Prometheus.
export function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  return {
    registry,
    requests: new Counter({
      name: 'gateway_requests_total',
      help: 'Requisições atendidas pelo gateway',
      labelNames: ['upstream', 'method', 'status'],
      registers: [registry],
    }),
    duration: new Histogram({
      name: 'gateway_request_duration_seconds',
      help: 'Duração da requisição, do gateway até a resposta',
      labelNames: ['upstream'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    }),
    authRejected: new Counter({
      name: 'gateway_auth_rejected_total',
      help: 'Requisições recusadas por token',
      labelNames: ['reason'],
      registers: [registry],
    }),
    rateLimited: new Counter({
      name: 'gateway_rate_limited_total',
      help: 'Requisições recusadas por rate limit',
      labelNames: ['scope'],
      registers: [registry],
    }),
    upstreamErrors: new Counter({
      name: 'gateway_upstream_errors_total',
      help: 'Falhas ao falar com o serviço de destino',
      labelNames: ['upstream', 'kind'],
      registers: [registry],
    }),
  };
}

export function registerMetrics(app: FastifyInstance, m: Metrics): void {
  app.decorateRequest('upstreamName', 'none');
  app.decorate('metricsRegistry', m.registry);
  app.addHook('onResponse', async (req, reply) => {
    m.requests.inc({
      upstream: req.upstreamName,
      method: req.method,
      status: String(reply.statusCode),
    });
    m.duration.observe({ upstream: req.upstreamName }, reply.elapsedTime / 1000);
    // caminho sem query string: token pode viajar em query e não deve ir para o log
    req.log.info(
      {
        correlation_id: req.correlationId,
        method: req.method,
        path: req.url.split('?')[0],
        status: reply.statusCode,
        upstream: req.upstreamName,
        ms: Math.round(reply.elapsedTime),
      },
      'request',
    );
  });
}
