// Permissões por perfil (ADR-016 § 1; ADR-017 § 1) e formulário de usuário (ADR-016 § 2), TASK-040.

import { describe, expect, it } from 'vitest'

import { permissionsFor, READ_ONLY_REASON } from '../../../src/application/auth/permissions'
import { validateNewUser, validateUserChanges } from '../../../src/application/auth/userForm'

describe('permissionsFor', () => {
  it('ADMIN edita e gerencia usuários; Operador só vê, com a explicação', () => {
    expect(permissionsFor('authenticated', 'ADMIN')).toEqual({
      canEdit: true,
      canManageUsers: true,
      canView: true,
      readOnlyReason: null,
    })
    expect(permissionsFor('authenticated', 'OPERATOR')).toEqual({
      canEdit: false,
      canManageUsers: false,
      canView: true,
      readOnlyReason: READ_ONLY_REASON,
    })
  })

  it('modo sem banco: tudo aberto, mas sem gestão de usuários', () => {
    expect(permissionsFor('disabled', null)).toEqual({
      canEdit: true,
      canManageUsers: false,
      canView: true,
      readOnlyReason: null,
    })
  })

  it('conferindo ou sem sessão: nada', () => {
    for (const status of ['loading', 'unauthenticated'] as const) {
      expect(permissionsFor(status, null)).toMatchObject({
        canEdit: false,
        canManageUsers: false,
        canView: false,
      })
    }
  })
})

describe('validateNewUser', () => {
  const valid = {
    username: '  Nova.Ficticia ',
    displayName: ' Nova FICTÍCIA ',
    role: 'OPERATOR' as const,
    password: 'senha-ficticia-1',
  }

  it('normaliza o nome de usuário para minúsculas e apara o nome', () => {
    expect(validateNewUser(valid)).toEqual({
      ok: true,
      value: {
        username: 'nova.ficticia',
        displayName: 'Nova FICTÍCIA',
        password: 'senha-ficticia-1',
        role: 'OPERATOR',
      },
    })
  })

  it('aponta nome de usuário, nome e senha fora da regra', () => {
    const result = validateNewUser({
      username: 'a b',
      displayName: ' ',
      role: 'ADMIN',
      password: 'curta',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(['displayName', 'password', 'username'])
    expect(validateNewUser({ ...valid, username: 'ab' }).ok).toBe(false)
    expect(validateNewUser({ ...valid, username: 'x'.repeat(65) }).ok).toBe(false)
    expect(validateNewUser({ ...valid, password: 'x'.repeat(129) }).ok).toBe(false)
    expect(validateNewUser({ ...valid, password: '' }).ok).toBe(false)
  })
})

describe('validateUserChanges', () => {
  const current = { displayName: 'Pessoa FICTÍCIA', role: 'OPERATOR' as const }

  it('manda só o que mudou; senha vazia mantém a atual', () => {
    expect(
      validateUserChanges(
        { username: 'x', displayName: 'Pessoa FICTÍCIA', role: 'OPERATOR', password: '' },
        current,
      ),
    ).toEqual({ ok: true, value: {} })
    expect(
      validateUserChanges(
        { username: 'x', displayName: ' Outra ', role: 'ADMIN', password: 'senha-nova-123' },
        current,
      ),
    ).toEqual({
      ok: true,
      value: { displayName: 'Outra', role: 'ADMIN', password: 'senha-nova-123' },
    })
  })

  it('nova senha curta ou nome vazio: erro', () => {
    const result = validateUserChanges(
      { username: 'x', displayName: '', role: 'OPERATOR', password: '123' },
      current,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['displayName', 'password'])
  })
})
