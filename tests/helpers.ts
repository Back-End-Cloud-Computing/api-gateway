import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, exportSPKI, generateKeyPair } from 'jose';
import type { Config } from '../src/config.js';

export const UPSTREAM_NAMES = [
  'authorization',
  'client',
  'order',
  'cart',
  'product',
  'promotion',
] as const;
export type UpstreamName = (typeof UPSTREAM_NAMES)[number];

export interface Call {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export interface FakeUpstream {
  url: string;
  calls: Call[];
  close: () => Promise<void>;
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export async function startUpstream(name: string, handler?: Handler): Promise<FakeUpstream> {
  const calls: Call[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      calls.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      if (handler) return handler(req, res);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ upstream: name }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export async function startAllUpstreams(): Promise<Record<UpstreamName, FakeUpstream>> {
  const entries = await Promise.all(
    UPSTREAM_NAMES.map(async (n) => [n, await startUpstream(n)] as const),
  );
  return Object.fromEntries(entries) as Record<UpstreamName, FakeUpstream>;
}

export interface Keys {
  publicPem: string;
  privateKey: CryptoKey;
  sign: (opts?: SignOptions) => Promise<string>;
}

export interface SignOptions {
  typ?: string;
  iss?: string;
  exp?: number | string;
  key?: CryptoKey;
}

export async function makeKeys(): Promise<Keys> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicPem = await exportSPKI(publicKey);
  const sign = (opts: SignOptions = {}) =>
    new SignJWT({ typ: opts.typ ?? 'access', email: 'user@example.com', role: 'USER' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('1')
      .setIssuer(opts.iss ?? 'ganjj-authorization')
      .setExpirationTime(opts.exp ?? '5m')
      .sign(opts.key ?? privateKey);
  return { publicPem, privateKey, sign };
}

export function testConfig(
  upstreams: Record<UpstreamName, { url: string }>,
  overrides: Partial<Config> = {},
): Config {
  return {
    port: 0,
    metricsPort: 0,
    logLevel: 'silent',
    authBaseUrl: upstreams.authorization.url,
    jwtPublicKey: undefined,
    jwtIssuer: 'ganjj-authorization',
    upstreams: Object.fromEntries(
      UPSTREAM_NAMES.map((n) => [n, upstreams[n].url]),
    ) as Config['upstreams'],
    upstreamTimeoutMs: 2000,
    rateLimitMax: 1000,
    rateLimitWindow: '1 minute',
    rateLimitAuthMax: 1000,
    corsOrigins: [],
    ...overrides,
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
