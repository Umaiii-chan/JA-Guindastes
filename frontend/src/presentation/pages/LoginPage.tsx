import { Eye, EyeOff, LogIn, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Wordmark } from '../layout/Wordmark'
import { Button, Field, Input, Notice, Spinner, type Tone } from '../ui'
import styles from './LoginPage.module.css'

export type LoginSubmitResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string }

export interface LoginPageProps {
  /** `checking`: conferindo a sessão no backend (mostra só o indicador). */
  readonly status: 'checking' | 'ready'
  /** Aviso acima do formulário (ex.: a sessão acabou; você saiu). */
  readonly notice?: { readonly tone: Tone; readonly text: string } | null
  readonly onSubmit: (username: string, password: string) => Promise<LoginSubmitResult>
}

/** Mensagem do erro de login na tela, pelos códigos do ADR-016 § 3 (401 e 429). */
function loginErrorMessage(result: Extract<LoginSubmitResult, { ok: false }>): string {
  switch (result.code) {
    case 'INVALID_CREDENTIALS':
      return 'Usuário ou senha incorretos. Confira e tente de novo.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Muitas tentativas sem sucesso. Aguarde 15 minutos antes de tentar de novo.'
    default:
      return result.message
  }
}

/**
 * `/login` (ADR-017 § 1), fora da casca: cartão de vidro sobre uma grade técnica com o traço de um
 * guindaste. Campos com rótulo, mostrar/ocultar senha, carregando e erros 401 e 429.
 */
export function LoginPage({ status, notice, onSubmit }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [missing, setMissing] = useState<{ username?: string; password?: string }>({})
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const nextMissing = {
      username: username.trim() === '' ? 'Informe o usuário.' : undefined,
      password: password === '' ? 'Informe a senha.' : undefined,
    }
    setMissing(nextMissing)
    if (nextMissing.username) return usernameRef.current?.focus()
    if (nextMissing.password) return passwordRef.current?.focus()

    setSubmitting(true)
    setError(null)
    const result = await onSubmit(username.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      setError({ code: result.code, message: loginErrorMessage(result) })
      if (result.code === 'INVALID_CREDENTIALS') setPassword('')
    }
  }

  // Depois de uma senha errada, o foco volta à senha (só depois de o campo ser reabilitado).
  useEffect(() => {
    if (error?.code === 'INVALID_CREDENTIALS') passwordRef.current?.focus()
  }, [error])

  return (
    <main className={styles.screen}>
      <LoginBackdrop />
      <section className={styles.card} aria-labelledby="login-title" aria-busy={submitting}>
        <div className={styles.brand}>
          <Wordmark variant="stacked" />
        </div>
        <div className={styles.heading}>
          <h1 id="login-title" className={styles.title}>
            Entrar
          </h1>
          <p className={styles.subtitle}>Use a conta criada pelo administrador.</p>
        </div>

        {status === 'checking' ? (
          <p className={styles.checking} role="status">
            <Spinner size={16} />
            Conferindo a sessão…
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {notice && (
              <Notice tone={notice.tone} compact role="status">
                {notice.text}
              </Notice>
            )}
            {error && (
              <Notice tone="danger" compact role="alert">
                {error.message}
              </Notice>
            )}
            <Field label="Usuário" error={missing.username} required>
              <Input
                ref={usernameRef}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                leadingIcon={<UserRound size={16} />}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Senha" error={missing.password} required>
              <div className={styles.passwordRow}>
                <Input
                  ref={passwordRef}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
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
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              icon={<LogIn size={16} />}
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        )}
      </section>
    </main>
  )
}

/**
 * Fundo decorativo: papel milimetrado (linhas de 10 e 50 px em tinta clara) e o traço do guindaste
 * com cotas, como uma prancha sob a folha de acesso. Só SVG, sem degradê nem dados.
 */
function LoginBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <svg className={styles.grid} width="100%" height="100%">
        <defs>
          <pattern id="login-mm" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" className={styles.gridMinor} />
          </pattern>
          <pattern id="login-cm" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="url(#login-mm)" />
            <path d="M50 0H0V50" className={styles.gridMajor} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-cm)" />
      </svg>
      <svg className={styles.blueprint} viewBox="0 0 800 500" fill="none">
        <g className={styles.blueprintInk}>
          <path d="M150 420h180" />
          <path d="M170 420l20-40h100l20 40" />
          <path d="M215 380v-26h50v26" />
          <path d="M240 354L600 110" />
          <path d="M252 362L604 124" />
          <path d="M600 110v150" />
          <rect x="585" y="260" width="30" height="24" />
        </g>
        <g className={styles.blueprintDim}>
          <path d="M240 330v130" strokeDasharray="10 3 2 3" />
          <path d="M600 290v170" />
          <path d="M240 452h360" />
          <path d="M240 452l8-3v6zM600 452l-8-3v6z" />
        </g>
        <g className={styles.blueprintLabel}>
          <text x="410" y="446">
            R
          </text>
          <text x="430" y="210">
            L
          </text>
          <text x="330" y="336">
            θ
          </text>
        </g>
      </svg>
    </div>
  )
}
