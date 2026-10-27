import { hostname } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import {
  UUID_RE,
  makeKeys,
  startAllUpstreams,
  startUpstream,
  testConfig,
  type FakeUpstream,
  type Keys,
  type UpstreamName,
} from './helpers.js';

let keys: Keys;
let up: Record<UpstreamName, FakeUpstream>;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  keys = await makeKeys();
  up = await startAllUpstreams();
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await Promise.all(Object.values(up).map((u) => u.close()));
});

const make = async (overrides = {}, upstreams = up) => {
  const app = await buildApp(testConfig(upstreams, { jwtPublicKey: keys.publicPem, ...overrides }));
  apps.push(app);
  return app;
};

describe('correlation id and forwarded headers', () => {
  it('E1 generates a uuid and passes the same id to the upstream', async () => {
    const app = await make();
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    const id = res.headers['x-correlation-id'];
    expect(id).toMatch(UUID_RE);
    expect(up.promotion.calls.at(-1)?.headers['x-correlation-id']).toBe(id);
  });

  it('E1b identifies the gateway pod that served the request', async () => {
    const app = await make();
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.headers['x-gateway-served-by']).toBe(hostname());
  });

  it('E2 replaces an invalid id and keeps a valid one', async () => {
    const app = await make();
    const bad = await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { 'x-correlation-id': 'nao-uuid' },
    });
    expect(bad.headers['x-correlation-id']).toMatch(UUID_RE);
    const good = '6a2f41a5-c3f9-4d0f-a8cb-0a6e8a8e1a11';
    const ok = await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { 'x-correlation-id': good },
    });
    expect(ok.headers['x-correlation-id']).toBe(good);
  });

  it('E3 forwards Idempotency-Key and Authorization to the order service', async () => {
    const app = await make();
    const token = await keys.sign();
    await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'abc-123',
        'content-type': 'application/json',
      },
      payload: '{}',
    });
    const last = up.order.calls.at(-1);
    expect(last?.headers['idempotency-key']).toBe('abc-123');
    expect(last?.headers.authorization).toBe(`Bearer ${token}`);
  });

  it('E9 preserves status and Location from the upstream', async () => {
    const created = await startUpstream('order', (_req, res) => {
      res.writeHead(201, { 'content-type': 'application/json', location: '/api/pedidos/7' });
      res.end('{"id":7}');
    });
    const app = await make({}, { ...up, order: created });
    const token = await keys.sign();
    const res = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers.location).toBe('/api/pedidos/7');
    await created.close();
  });
});

describe('rate limit', () => {
  it('E4 returns 429 with Retry-After after the global limit', async () => {
    const app = await make({ rateLimitMax: 3 });
    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: 'GET', url: '/api/sale' })).statusCode).toBe(200);
    }
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.json()).toHaveProperty('error');
  });

  it('E5 limits login separately from the global limit', async () => {
    const app = await make({ rateLimitMax: 1000, rateLimitAuthMax: 2 });
    const login = () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      });
    expect((await login()).statusCode).toBe(200);
    expect((await login()).statusCode).toBe(200);
    expect((await login()).statusCode).toBe(429);
    expect((await app.inject({ method: 'GET', url: '/api/sale' })).statusCode).toBe(200);
  });
});

describe('upstream failures', () => {
  // undici agrupa timers em passos de ~500 ms: timeout menor que isso dispara atrasado
  it('E6 returns 504 when the upstream is slower than the timeout', async () => {
    const slow = await startUpstream('promotion', (_req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end('{}');
      }, 2500);
    });
    const app = await make({ upstreamTimeoutMs: 600 }, { ...up, promotion: slow });
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.statusCode).toBe(504);
    expect(res.json()).toHaveProperty('correlation_id');
    await slow.close();
  });

  it('E6b gives POST /products its own, longer timeout', async () => {
    const slow = await startUpstream('product', (_req, res) => {
      setTimeout(() => {
        res.writeHead(201);
        res.end('{}');
      }, 1500);
    });
    const app = await make(
      { upstreamTimeoutMs: 600, productCreateTimeoutMs: 3000 },
      { ...up, product: slow },
    );
    const auth = { authorization: `Bearer ${await keys.sign()}` };
    const post = await app.inject({ method: 'POST', url: '/products', headers: auth, payload: {} });
    expect(post.statusCode).toBe(201);
    const get = await app.inject({ method: 'GET', url: '/products', headers: auth });
    expect(get.statusCode).toBe(504);
    await slow.close();
  });

  it('E7 returns 502 when the upstream is down', async () => {
    const dead = await startUpstream('promotion');
    const url = dead.url;
    await dead.close();
    const app = await make({}, { ...up, promotion: { ...dead, url } });
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.statusCode).toBe(502);
  });
});

describe('cors', () => {
  it('E8 answers only for configured origins', async () => {
    const app = await make({ corsOrigins: ['http://allowed.test'] });
    const ok = await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { origin: 'http://allowed.test' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://allowed.test');
    const no = await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { origin: 'http://evil.test' },
    });
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
    const pre = await app.inject({
      method: 'OPTIONS',
      url: '/products',
      headers: { origin: 'http://allowed.test', 'access-control-request-method': 'GET' },
    });
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('http://allowed.test');
  });

  it('is off when no origin is configured', async () => {
    const app = await make({ corsOrigins: [] });
    const res = await app.inject({
      method: 'GET',
      url: '/api/sale',
      headers: { origin: 'http://allowed.test' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
