export const UPSTREAM_NAMES = [
  'authorization',
  'client',
  'order',
  'cart',
  'product',
  'promotion',
] as const;
export type UpstreamName = (typeof UPSTREAM_NAMES)[number];

export interface Config {
  port: number;
  metricsPort: number;
  logLevel: string;
  authBaseUrl: string;
  jwtPublicKey: string | undefined;
  jwtIssuer: string;
  upstreams: Record<UpstreamName, string>;
  upstreamTimeoutMs: number;
  rateLimitMax: number;
  rateLimitWindow: string;
  rateLimitAuthMax: number;
  corsOrigins: string[];
}

const int = (env: NodeJS.ProcessEnv, name: string, fallback: number): number => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`variável ${name} deve ser um inteiro positivo`);
  return n;
};

const url = (env: NodeJS.ProcessEnv, name: string, fallback: string): string => {
  const raw = env[name] || fallback;
  try {
    new URL(raw);
  } catch {
    throw new Error(`variável ${name} não é uma URL válida`);
  }
  return raw.replace(/\/+$/, '');
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const authBaseUrl = url(env, 'AUTH_BASE_URL', 'http://authorization:8081');
  return {
    port: int(env, 'PORT', 3000),
    metricsPort: int(env, 'METRICS_PORT', 9100),
    logLevel: env.LOG_LEVEL || 'info',
    authBaseUrl,
    // ConfigMap e .env costumam trazer o PEM com "\n" literal
    jwtPublicKey: env.JWT_PUBLIC_KEY ? env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n') : undefined,
    jwtIssuer: env.JWT_ISSUER || 'ganjj-authorization',
    upstreams: {
      authorization: authBaseUrl,
      client: url(env, 'CLIENT_URL', 'http://client:8082'),
      order: url(env, 'ORDER_URL', 'http://order:8080'),
      cart: url(env, 'CART_URL', 'http://shopping-cart:3003'),
      product: url(env, 'PRODUCT_URL', 'http://product-api:8000'),
      promotion: url(env, 'PROMOTION_URL', 'http://promotion:8000'),
    },
    upstreamTimeoutMs: int(env, 'UPSTREAM_TIMEOUT_MS', 10_000),
    rateLimitMax: int(env, 'RATE_LIMIT_MAX', 100),
    rateLimitWindow: env.RATE_LIMIT_WINDOW || '1 minute',
    rateLimitAuthMax: int(env, 'RATE_LIMIT_AUTH_MAX', 10),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
