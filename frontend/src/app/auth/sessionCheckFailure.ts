// Queda da conferência de sessão (integração da leva D): só backend ausente leva ao modo sem
// autenticação; qualquer outra falha (ex.: HTTP 500) leva ao login.

import { AuthRequestError } from '../../domain/auth/user'

/** Status HTTP que indicam backend ausente atrás do proxy (Vite em dev, nginx no container). */
const BACKEND_ABSENT_STATUSES: ReadonlySet<number> = new Set([404, 502, 503, 504])

/** `true` quando a falha de `GET /auth/session` indica que não há backend (rede ou proxy). */
export function isBackendAbsent(error: unknown): boolean {
  if (!(error instanceof AuthRequestError)) return false
  if (error.code === 'NETWORK_ERROR') return true
  return error.httpStatus !== null && BACKEND_ABSENT_STATUSES.has(error.httpStatus)
}
