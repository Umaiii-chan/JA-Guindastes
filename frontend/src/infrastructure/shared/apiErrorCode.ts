// Código de erro legível por máquina no corpo de uma resposta de erro do backend (TASK-046).
//
// O contrato da TASK-046 § 3 fixa os códigos (`ROTATION_ZONE_IN_USE`, `INVALID_ROTATION_ZONES`,
// `ROTATION_ZONE_REQUIRED`...), e diz que eles vêm "no mesmo formato de erro das rotas", sem fixar
// onde. Para não depender de um só formato, o código é procurado, nesta ordem:
// 1. `{"code": "X"}` (como `ApiErrorResponse` da autorização);
// 2. `{"detail": {"code": "X", ...}}`;
// 3. `{"detail": [{"type" | "msg" | "ctx.code": ...}]}` (422 do FastAPI com erro de domínio);
// 4. `{"detail": "... X ..."}` (texto com o código);
// 5. `{"issues": [{"code": "X"}]}` (relatório de importação).
// Só os códigos de `known` contam: texto livre do backend nunca vira código por acaso.

import { isRecord } from './readJson'

function matchCode(value: unknown, known: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  return known.find((code) => value === code || value.includes(code)) ?? null
}

export function findApiErrorCode(body: unknown, known: readonly string[]): string | null {
  if (!isRecord(body)) return null
  const direct = matchCode(body.code, known)
  if (direct) return direct
  const detail = body.detail
  if (isRecord(detail)) {
    const nested = matchCode(detail.code, known) ?? matchCode(detail.message, known)
    if (nested) return nested
  }
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (!isRecord(item)) continue
      const ctx = isRecord(item.ctx) ? item.ctx : null
      const found =
        matchCode(ctx?.code, known) ??
        matchCode(item.type, known) ??
        matchCode(item.code, known) ??
        matchCode(item.msg, known) ??
        matchCode(ctx?.error, known)
      if (found) return found
    }
  }
  const inText = matchCode(detail, known)
  if (inText) return inText
  if (Array.isArray(body.issues)) {
    for (const issue of body.issues) {
      const found = isRecord(issue) ? matchCode(issue.code, known) : null
      if (found) return found
    }
  }
  return null
}

/** Texto do `detail` (ou `detail.message`), quando é texto; `null` caso contrário. */
export function detailText(body: unknown): string | null {
  if (!isRecord(body)) return null
  const detail = isRecord(body.detail) ? body.detail.message : body.detail
  return typeof detail === 'string' && detail.trim() !== '' ? detail : null
}
