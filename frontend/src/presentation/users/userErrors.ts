// Explicação dos erros da gestão de usuários (TASK-040; ADR-016 § 2, contrato da TASK-038).

import type { UserFormErrors, UserFormField } from '../../application/auth/userForm'
import type { AuthRequestError } from '../../domain/auth/user'

const FORM_FIELDS: readonly UserFormField[] = ['username', 'displayName', 'role', 'password']

export interface ExplainedUserError {
  /** Título curto do aviso. */
  readonly title: string
  /** O que aconteceu e o que fazer. */
  readonly message: string
  /** Erros por campo (409 `USERNAME_TAKEN`, 422). */
  readonly fieldErrors: UserFormErrors
}

export function explainUserError(error: AuthRequestError): ExplainedUserError {
  switch (error.code) {
    case 'USERNAME_TAKEN':
      return {
        title: 'Nome de usuário em uso',
        message: 'Já existe uma conta com esse nome de usuário. Escolha outro.',
        fieldErrors: { username: 'Já existe uma conta com esse nome de usuário.' },
      }
    case 'LAST_ADMIN':
      return {
        title: 'É o último administrador ativo',
        message:
          'O sistema precisa de pelo menos um administrador ativo. Promova outra conta a ' +
          'Administrador antes de desativar ou rebaixar esta.',
        fieldErrors: {},
      }
    case 'OWN_ADMIN_ACCESS':
      return {
        title: 'Não dá para mexer no próprio acesso',
        message:
          'Você não pode desativar a própria conta nem tirar o próprio perfil de Administrador. ' +
          'Peça a outro administrador, se for preciso.',
        fieldErrors: {},
      }
    case 'USER_NOT_FOUND':
      return {
        title: 'Conta não encontrada',
        message: 'Essa conta não existe mais. A lista foi recarregada.',
        fieldErrors: {},
      }
    case 'VALIDATION': {
      const fieldErrors: UserFormErrors = {}
      for (const item of error.fieldErrors) {
        const field = FORM_FIELDS.find((candidate) => candidate === item.field)
        if (field && !fieldErrors[field]) fieldErrors[field] = item.message
      }
      return { title: 'Dados recusados', message: error.message, fieldErrors }
    }
    default:
      return { title: 'Não foi possível salvar', message: error.message, fieldErrors: {} }
  }
}
