import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
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
let other: Keys;
let up: Record<UpstreamName, FakeUpstream>;

beforeAll(async () => {
  keys = await makeKeys();
  other = await makeKeys();
  up = await startAllUpstreams();
  app = await buildApp(testConfig(up, { jwtPublicKey: keys.publicPem }));
});

afterAll(async () => {
  await app.close();
  await Promise.all(Object.values(up).map((u) => u.close()));
});

const get = (token?: string, extra: Record<string, string> = {}) =>
  app.inject({
    method: 'GET',
    url: '/clients/me',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
  });

const rejected = async (reason: string) =>
  (await app.metricsRegistry.metrics()).includes(`gateway_auth_rejected_total{reason="${reason}"}`);

describe('jwt at the edge', () => {
  it('missing token is rejected with reason missing', async () => {
    expect((await get()).statusCode).toBe(401);
    expect(await rejected('missing')).toBe(true);
  });

  it('A1 token signed with another key is invalid', async () => {
    const res = await get(await other.sign());
    expect(res.statusCode).toBe(401);
    expect(await rejected('invalid')).toBe(true);
  });

  it('A2 expired token', async () => {
    const res = await get(await keys.sign({ exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(res.statusCode).toBe(401);
    expect(await rejected('expired')).toBe(true);
  });

  it('A3 refresh token is not an access token', async () => {
    const res = await get(await keys.sign({ typ: 'refresh' }));
    expect(res.statusCode).toBe(401);
    expect(await rejected('wrong_type')).toBe(true);
  });

  it('A4 different issuer', async () => {
    const res = await get(await keys.sign({ iss: 'outro-emissor' }));
    expect(res.statusCode).toBe(401);
  });

  it('A5 HS256 and alg none are refused', async () => {
    const hs = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('ganjj-authorization')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('segredo-compartilhado'));
    expect((await get(hs)).statusCode).toBe(401);

    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ typ: 'access', iss: 'ganjj-authorization' })}.`;
    expect((await get(none)).statusCode).toBe(401);
  });

  it('A6 accepts the accessToken cookie', async () => {
    const token = await keys.sign();
    const res = await app.inject({
      method: 'GET',
      url: '/clients/me',
      headers: { cookie: `a=1; accessToken=${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('valid token is forwarded untouched', async () => {
    const token = await keys.sign();
    await get(token);
    expect(up.client.calls.at(-1)?.headers.authorization).toBe(`Bearer ${token}`);
  });
});

describe('public key not loaded', () => {
  it('A7 readiness and protected routes return 503', async () => {
    const closedPort = 'http://127.0.0.1:1';
    const lazy = await buildApp(
      testConfig(up, { authBaseUrl: closedPort, jwtPublicKey: undefined }),
    );
    expect((await lazy.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(503);
    expect((await lazy.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const res = await lazy.inject({
      method: 'GET',
      url: '/products',
      headers: { authorization: `Bearer ${await keys.sign()}` },
    });
    expect(res.statusCode).toBe(503);
    await lazy.close();
  });

  it('loads the key from authorization at boot', async () => {
    const authUp = await (
      await import('./helpers.js')
    ).startUpstream('auth', (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(keys.publicPem);
    });
    const booted = await buildApp(
      testConfig(up, { authBaseUrl: authUp.url, jwtPublicKey: undefined }),
    );
    await booted.keyReady;
    expect((await booted.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(200);
    await booted.close();
    await authUp.close();
  });
});
