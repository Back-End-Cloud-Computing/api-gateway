const TIMEOUT_CODES = new Set([
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'FST_REPLY_FROM_GATEWAY_TIMEOUT',
  'FST_REPLY_FROM_TIMEOUT',
  'FST_REPLY_FROM_HTTP_REQUEST_TIMEOUT',
]);

export type UpstreamErrorKind = 'timeout' | 'unreachable';

// Serviço lento vira 504; serviço fora (recusou, resetou, DNS) vira 502.
export function classifyUpstreamError(err: unknown): {
  status: 502 | 504;
  kind: UpstreamErrorKind;
  message: string;
} {
  const code = (err as { code?: string } | undefined)?.code ?? '';
  if (TIMEOUT_CODES.has(code))
    return { status: 504, kind: 'timeout', message: 'o serviço não respondeu a tempo' };
  return { status: 502, kind: 'unreachable', message: 'serviço indisponível' };
}
