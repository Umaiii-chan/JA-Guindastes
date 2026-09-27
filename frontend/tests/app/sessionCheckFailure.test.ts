// Queda da conferência de sessão (integração da leva D): só backend ausente leva ao modo sem
// autenticação; qualquer outra falha leva ao login.

import { describe, expect, it } from 'vitest'

import { isBackendAbsent } from '../../src/app/auth/sessionCheckFailure'
import { AuthRequestError } from '../../src/domain/auth/user'

describe('isBackendAbsent', () => {
  it('falha de rede → backend ausente (modo sem autenticação)', () => {
    expect(isBackendAbsent(new AuthRequestError('NETWORK_ERROR', 'sem rede'))).toBe(true)
  })

  it.each([404, 502, 503, 504])('HTTP %i atrás do proxy → backend ausente', (status) => {
    expect(isBackendAbsent(new AuthRequestError('HTTP_ERROR', 'ausente', status))).toBe(true)
  })

  it('HTTP 500, resposta fora do contrato ou erro desconhecido → login', () => {
    expect(isBackendAbsent(new AuthRequestError('HTTP_ERROR', 'erro interno', 500))).toBe(false)
    expect(isBackendAbsent(new AuthRequestError('INVALID_RESPONSE', 'x'))).toBe(false)
    expect(isBackendAbsent(new Error('x'))).toBe(false)
  })
})
