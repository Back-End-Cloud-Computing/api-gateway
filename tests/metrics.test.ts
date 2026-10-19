import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, buildMetricsApp } from '../src/server.js';
import {
  makeKeys,
  startAllUpstreams,
  testConfig,
  type FakeUpstream,
  type Keys,
  type UpstreamName,
} from './helpers.js';

let app: FastifyInstance;
let keys: Keys;
let up: Record<UpstreamName, FakeUpstream>;

beforeAll(async () => {
  keys = await makeKeys();
  up = await startAllUpstreams();
  app = await buildApp(testConfig(up, { jwtPublicKey: keys.publicPem, rateLimitMax: 2 }));
});

afterAll(async () => {
  await app.close();
  await Promise.all(Object.values(up).map((u) => u.close()));
});

describe('metrics', () => {
  it('M1 counts a proxied request by upstream, method and status', async () => {
    await app.inject({ method: 'GET', url: '/api/sale' });
    const text = await app.metricsRegistry.metrics();
    expect(text).toContain(
      'gateway_requests_total{upstream="promotion",method="GET",status="200"} 1',
    );
    expect(text).toContain('gateway_request_duration_seconds_bucket');
  });

  it('M2 counts a 401 by reason', async () => {
    await app.inject({ method: 'GET', url: '/clients/me' });
    expect(await app.metricsRegistry.metrics()).toContain(
      'gateway_auth_rejected_total{reason="missing"} 1',
    );
  });

  it('M3 counts a 429 by scope', async () => {
    await app.inject({ method: 'GET', url: '/api/sale' });
    const res = await app.inject({ method: 'GET', url: '/api/sale' });
    expect(res.statusCode).toBe(429);
    expect(await app.metricsRegistry.metrics()).toContain(
      'gateway_rate_limited_total{scope="global"} 1',
    );
  });

  it('M4 never puts the raw path in a label', async () => {
    const fresh = await buildApp(testConfig(up, { jwtPublicKey: keys.publicPem }));
    await fresh.inject({ method: 'GET', url: '/qualquer/coisa-aleatoria-123' });
    const text = await fresh.metricsRegistry.metrics();
    expect(text).not.toContain('coisa-aleatoria-123');
    expect(text).toContain('upstream="none"');
    await fresh.close();
  });

  it('serves /metrics on the dedicated app', async () => {
    const metricsApp = buildMetricsApp(app.metricsRegistry);
    const res = await metricsApp.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('gateway_requests_total');
    await metricsApp.close();
  });
});
