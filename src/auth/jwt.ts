import { errors, importSPKI, jwtVerify } from 'jose';

export type RejectReason = 'invalid' | 'expired' | 'wrong_type';
export type VerifyResult = { ok: true } | { ok: false; reason: RejectReason };

export class Verifier {
  private key: CryptoKey | undefined;

  constructor(private readonly issuer: string) {}

  get ready(): boolean {
    return this.key !== undefined;
  }

  async setKey(pem: string): Promise<void> {
    this.key = await importSPKI(pem.trim(), 'RS256');
  }

  async verify(token: string): Promise<VerifyResult> {
    if (!this.key) return { ok: false, reason: 'invalid' };
    try {
      // algoritmo fixado no código, nunca lido do header do token (bloqueia alg none e HS256)
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['RS256'],
        issuer: this.issuer,
      });
      return payload.typ === 'access' ? { ok: true } : { ok: false, reason: 'wrong_type' };
    } catch (err) {
      return { ok: false, reason: err instanceof errors.JWTExpired ? 'expired' : 'invalid' };
    }
  }
}

interface Logger {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

// Busca GET {baseUrl}/auth/public-key (PEM em texto puro) no boot; tenta de novo com espera crescente.
export function startKeyLoader(
  verifier: Verifier,
  baseUrl: string,
  log: Logger,
): { ready: Promise<void>; stop: () => void } {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));

  const attempt = async (n: number): Promise<void> => {
    if (stopped) return;
    try {
      const res = await fetch(`${baseUrl}/auth/public-key`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await verifier.setKey(await res.text());
      log.info({ baseUrl }, 'chave pública carregada');
      resolveReady();
    } catch (err) {
      const delay = Math.min(1000 * 2 ** n, 30_000);
      log.warn({ err: String(err), retryInMs: delay }, 'chave pública indisponível');
      if (stopped) return;
      timer = setTimeout(() => void attempt(n + 1), delay);
      timer.unref();
    }
  };
  void attempt(0);

  return {
    ready,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
