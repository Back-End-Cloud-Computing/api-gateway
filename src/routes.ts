import type { UpstreamName } from './config.js';

export type Access = 'public' | 'token';

export interface Route {
  upstream: UpstreamName;
  access: Access;
  pattern: RegExp;
  methods?: string[];
}

// Lista de permissão: o que não está aqui retorna 404 (inclui /internal/*, /metrics e /health dos serviços).
// Públicas primeiro (mais específicas); o resto exige token. Papel ADMIN é checado no serviço de destino.
export const routes: Route[] = [
  {
    upstream: 'authorization',
    access: 'public',
    pattern: /^\/auth\/(register|login|refresh|logout)$/,
    methods: ['POST'],
  },
  {
    upstream: 'authorization',
    access: 'public',
    pattern: /^\/auth\/public-key$/,
    methods: ['GET'],
  },
  { upstream: 'promotion', access: 'public', pattern: /^\/api\/sale$/, methods: ['GET'] },
  {
    upstream: 'promotion',
    access: 'public',
    pattern: /^\/api\/coupons\/[^/]+\/validate$/,
    methods: ['GET'],
  },

  { upstream: 'authorization', access: 'token', pattern: /^\/auth(\/|$)/ },
  { upstream: 'client', access: 'token', pattern: /^\/clients(\/|$)/ },
  { upstream: 'order', access: 'token', pattern: /^\/api\/pedidos(\/|$)/ },
  { upstream: 'cart', access: 'token', pattern: /^\/api\/cart(\/|$)/ },
  { upstream: 'product', access: 'token', pattern: /^\/(products|search)(\/|$)/ },
  {
    upstream: 'promotion',
    access: 'token',
    pattern: /^\/api\/(promotions|coupons|campaigns)(\/|$)/,
  },
];

export function findRoute(method: string, path: string): Route | undefined {
  return routes.find((r) => r.pattern.test(path) && (!r.methods || r.methods.includes(method)));
}
