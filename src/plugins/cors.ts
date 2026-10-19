import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

// Sem CORS_ORIGINS o CORS fica desligado (nenhum cabeçalho). hook onRequest: o preflight responde
// dentro do hook, sem registrar uma rota OPTIONS que conflitaria com a rota coringa do proxy.
export async function registerCors(app: FastifyInstance, config: Config): Promise<void> {
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    hook: 'onRequest',
  });
}
