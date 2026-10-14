import { ChevronDown, DatabaseZap, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Badge, Spinner } from '../ui'
import styles from './UserMenu.module.css'

export interface UserMenuUser {
  readonly name: string
  /** Perfil exibido (ex.: Administrador, Operador). */
  readonly role: string
  readonly username?: string
}

export interface UserMenuProps {
  /** `null` no modo sem autenticação (sem banco; ADR-016 § 5). */
  readonly user: UserMenuUser | null
  /** Encerra a sessão ("Sair"). */
  readonly onSignOut?: () => Promise<void> | void
}

/**
 * Menu do usuário na barra superior (ADR-017 § 1): nome e perfil; ao abrir, o usuário e "Sair". No
 * modo sem banco, mostra o aviso "modo sem autenticação (sem banco)".
 */
export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (user === null) {
    return (
      <div
        className={styles.placeholder}
        title="Servidor sem banco de dados: não há login e todas as ações ficam abertas (só para desenvolvimento)."
        data-testid="user-menu"
        role="note"
      >
        <span className={styles.avatar} aria-hidden="true">
          <DatabaseZap size={15} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>Modo sem autenticação</span>
          <span className={styles.role}>sem banco</span>
        </span>
        <Badge tone="warning" variant="outline">
          sem login
        </Badge>
      </div>
    )
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await onSignOut?.()
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef} data-testid="user-menu">
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu do usuário: ${user.name}, ${user.role}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.role}>{user.role}</span>
        </span>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} id={menuId} role="menu" aria-label="Conta">
          <div className={styles.menuHeader}>
            <p className={styles.menuName}>{user.name}</p>
            {user.username && <p className={styles.menuUsername}>@{user.username}</p>}
            <Badge tone="info">{user.role}</Badge>
          </div>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            autoFocus
          >
            {signingOut ? <Spinner size={14} /> : <LogOut size={15} aria-hidden="true" />}
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
