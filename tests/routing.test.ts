import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import {
  makeKeys,
  startAllUpstreams,
  startUpstream,
  testConfig,
  type FakeUpstream,
  type Keys,
  type UpstreamName,
} from './helpers.js';

let app: FastifyInstance;
let keys: Keys;
let up: Record<UpstreamName, FakeUpstream>;
let token: string;

beforeAll(async () => {
  keys = await makeKeys();
  up = await startAllUpstreams();
  app = await buildApp(testConfig(up, { jwtPublicKey: keys.publicPem }));
  token = await keys.sign();
});

afterAll(async () => {
  await app.close();
  await Promise.all(Object.values(up).map((u) => u.close()));
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('routing', () => {
  it('R1 forwards a public route without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ upstream: 'promotion' });
  });

  it('R2 rejects a protected route without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/products' });
    expect(res.statusCode).toBe(401);
  });

  it('R3 forwards a protected route with a valid token', async () => {
    const res = await app.inject({ method: 'GET', url: '/products', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ upstream: 'product' });
  });

  it('R4 never forwards /internal, even with a token', async () => {
    const before = up.promotion.calls.length;
    const res = await app.inject({
      method: 'GET',
      url: '/internal/discounts/calculate',
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(up.promotion.calls.length).toBe(before);
  });

  it('R5 does not serve /metrics on the public port', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['/api/pedidos', 'order'],
    ['/api/pedidos/7', 'order'],
    ['/api/cart', 'cart'],
    ['/api/promotions', 'promotion'],
    ['/api/campaigns/3', 'promotion'],
    ['/clients/me', 'client'],
    ['/auth/me', 'authorization'],
    ['/search/lexical', 'product'],
  ])('R6 routes %s to %s', async (url, upstream) => {
    const res = await app.inject({ method: 'GET', url, headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ upstream });
  });

  it('R7 strips x-internal-secret sent by the client', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { 'x-internal-secret': 'segredo' },
    });
    const last = up.promotion.calls.at(-1);
    expect(last?.headers['x-internal-secret']).toBeUndefined();
  });

  it('R8 forwards login without a token and keeps the body intact', async () => {
    const body = JSON.stringify({ email: 'a@b.c', password: 'x' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const last = up.authorization.calls.at(-1);
    expect(last?.method).toBe('POST');
    expect(last?.body).toBe(body);
  });

  it('R9 only the coupon validate route is public', async () => {
    const pub = await app.inject({ method: 'GET', url: '/api/coupons/ABC/validate' });
    expect(pub.statusCode).toBe(200);
    const priv = await app.inject({ method: 'GET', url: '/api/coupons' });
    expect(priv.statusCode).toBe(401);
  });

  it('R10 unknown path returns 404 with the flat error format', async () => {
    const res = await app.inject({ method: 'GET', url: '/nada/aqui' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
    expect(res.json()).toHaveProperty('correlation_id');
  });

  it('R11 preserves the order contract headers, body, status and Location', async () => {
    const location = '/api/pedidos/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const order = await startUpstream('order', (_req, res) => {
      res.writeHead(201, { location, 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }));
    });
    const isolatedApp = await buildApp(
      testConfig({ ...up, order }, { jwtPublicKey: keys.publicPem }),
    );
    const correlationId = '6a2f41a5-c3f9-4d0f-a8cb-0a6e8a8e1a11';
    const idempotencyKey = 'checkout-gateway-contract';
    const cookie = `accessToken=${token}; theme=dark`;
    const body = JSON.stringify({
      endereco_entrega: { rua: 'Rua A', numero: '1' },
    });

    try {
      const res = await isolatedApp.inject({
        method: 'POST',
        url: '/api/pedidos',
        headers: {
          ...auth(),
          cookie,
          'idempotency-key': idempotencyKey,
          'x-correlation-id': correlationId,
          'x-internal-secret': 'must-not-cross-the-gateway',
          'content-type': 'application/json',
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      expect(res.headers.location).toBe(location);
      expect(res.headers['x-correlation-id']).toBe(correlationId);
      const last = order.calls.at(-1);
      expect(last?.method).toBe('POST');
      expect(last?.url).toBe('/api/pedidos');
      expect(last?.headers.authorization).toBe(`Bearer ${token}`);
      expect(last?.headers.cookie).toBe(cookie);
      expect(last?.headers['idempotency-key']).toBe(idempotencyKey);
      expect(last?.headers['x-correlation-id']).toBe(correlationId);
      expect(last?.headers['x-internal-secret']).toBeUndefined();
      expect(last?.body).toBe(body);
    } finally {
      await isolatedApp.close();
      await order.close();
    }
  });
});
