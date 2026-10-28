import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { FastifyInstance } from 'fastify';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Aceita o X-Correlation-ID do cliente só se for UUID (evita injeção em log); senão gera um novo.
export function registerCorrelation(app: FastifyInstance): void {
  app.decorateRequest('correlationId', '');
  app.addHook('onRequest', async (req, reply) => {
    const incoming = req.headers['x-correlation-id'];
    req.correlationId =
      typeof incoming === 'string' && UUID_RE.test(incoming) ? incoming : randomUUID();
    reply.header('x-correlation-id', req.correlationId);
    // Pod do gateway que atendeu (evidência de balanceamento na N2). Nome próprio porque o
    // X-Served-By do upstream passa pelo reply-from e mostra o pod do serviço.
    reply.header('x-gateway-served-by', hostname());
  });
}
