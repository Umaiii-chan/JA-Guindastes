import { Eye, EyeOff, Save, UserPlus } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import type { UsersGateway } from '../../application/auth/ports'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type UserFormErrors,
  type UserFormValues,
  validateNewUser,
  validateUserChanges,
} from '../../application/auth/userForm'
import { AuthRequestError, ROLE_LABEL, type User, USER_ROLES } from '../../domain/auth/user'
import { Button, Drawer, Field, Input, Notice, Select } from '../ui'
import styles from './UserFormDrawer.module.css'
import { type ExplainedUserError, explainUserError } from './userErrors'

export type UserFormTarget =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly user: User; readonly isSelf: boolean }

export interface UserFormDrawerProps {
  readonly target: UserFormTarget
  readonly gateway: UsersGateway
  readonly onClose: () => void
  readonly onSaved: (user: User, kind: UserFormTarget['kind']) => void
  /** A conta sumiu no backend (404): a lista precisa recarregar. */
  readonly onNotFound: () => void
}

function initialValues(target: UserFormTarget): UserFormValues {
  if (target.kind === 'create') {
    return { username: '', displayName: '', role: 'OPERATOR', password: '' }
  }
  return {
    username: target.user.username,
    displayName: target.user.displayName,
    role: target.user.role,
    password: '',
  }
}

/** Criar ou editar uma conta num `Drawer` (TASK-040 CA-4): nome, perfil e senha. */
export function UserFormDrawer({
  target,
  gateway,
  onClose,
  onSaved,
  onNotFound,
}: UserFormDrawerProps) {
  const formId = useId()
  const [values, setValues] = useState<UserFormValues>(() => initialValues(target))
  const [errors, setErrors] = useState<UserFormErrors>({})
  const [failure, setFailure] = useState<ExplainedUserError | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const editing = target.kind === 'edit'
  const isSelf = target.kind === 'edit' && target.isSelf

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setFailure(null)
    let request: () => Promise<User>
    if (target.kind === 'create') {
      const checked = validateNewUser(values)
      if (!checked.ok) return setErrors(checked.errors)
      request = () => gateway.create(checked.value)
    } else {
      const checked = validateUserChanges(values, target.user)
      if (!checked.ok) return setErrors(checked.errors)
      if (Object.keys(checked.value).length === 0) return onClose()
      request = () => gateway.update(target.user.id, checked.value)
    }
    setSaving(true)
    try {
      onSaved(await request(), target.kind)
    } catch (error) {
      if (!(error instanceof AuthRequestError)) throw error
      const explained = explainUserError(error)
      setErrors(explained.fieldErrors)
      setFailure(explained)
      if (error.code === 'USER_NOT_FOUND') onNotFound()
    } finally {
      setSaving(false)
    }
  }

  const passwordHint = editing
    ? `Deixe em branco para manter a senha atual. Nova senha: ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`
    : `${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres. Entregue à pessoa por um canal seguro.`

  return (
    <Drawer
      width={480}
      open
      onClose={onClose}
      title={editing ? 'Editar usuário' : 'Novo usuário'}
      description={
        editing
          ? 'Altere o nome de exibição, o perfil ou a senha. O nome de usuário não muda.'
          : 'A conta nasce ativa. Administradores gerenciam tudo; Operadores só consultam e simulam.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={saving}
            icon={editing ? <Save size={16} /> : <UserPlus size={16} />}
          >
            {editing ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        {failure && (
          <Notice tone="danger" role="alert" title={failure.title}>
            {failure.message}
          </Notice>
        )}
        <Field
          className={styles.row}
          label="Nome de usuário"
          required={!editing}
          error={errors.username}
          hint={editing ? 'Não pode ser alterado.' : '3 a 64 caracteres: a-z, 0-9, ponto, - ou _.'}
        >
          <Input
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            readOnly={editing}
            onChange={(event) => set('username', event.target.value)}
          />
        </Field>
        <Field label="Nome de exibição" required error={errors.displayName} className={styles.row}>
          <Input
            name="displayName"
            autoComplete="off"
            value={values.displayName}
            onChange={(event) => set('displayName', event.target.value)}
          />
        </Field>
        <Field
          className={styles.row}
          label="Perfil"
          required
          error={errors.role}
          hint={
            isSelf
              ? 'Você não pode tirar o próprio perfil de Administrador.'
              : 'Administrador: cadastros, tabelas e usuários. Operador: consulta e simulação.'
          }
        >
          <Select
            name="role"
            value={values.role}
            disabled={isSelf}
            onChange={(event) => set('role', event.target.value as UserFormValues['role'])}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          className={styles.row}
          label={editing ? 'Nova senha' : 'Senha'}
          required={!editing}
          error={errors.password}
          hint={passwordHint}
        >
          <div className={styles.passwordRow}>
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
              className={styles.passwordInput}
            />
            <button
              type="button"
              className={styles.reveal}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>
      </form>
    </Drawer>
  )
}
