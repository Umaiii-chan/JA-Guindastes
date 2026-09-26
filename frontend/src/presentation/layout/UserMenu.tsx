import { UserRound } from 'lucide-react'

import { Badge } from '../ui'
import styles from './UserMenu.module.css'

export interface UserMenuUser {
  readonly name: string
  /** Perfil exibido (ex.: ADMIN, Operador). */
  readonly role: string
}

export interface UserMenuProps {
  /** `null` enquanto não há autenticação (TASK-040 liga o login). */
  readonly user: UserMenuUser | null
}

/**
 * Espaço reservado do menu do usuário (ADR-017 § 1). Hoje não há login: mostra "Sem autenticação".
 * A TASK-040 troca por um menu com nome, perfil e "Sair".
 */
export function UserMenu({ user }: UserMenuProps) {
  if (user === null) {
    return (
      <div
        className={styles.placeholder}
        title="O login e os perfis chegam na TASK-040"
        data-testid="user-menu"
      >
        <span className={styles.avatar} aria-hidden="true">
          <UserRound size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>Sem autenticação</span>
          <span className={styles.role}>acesso aberto</span>
        </span>
        <Badge tone="neutral" variant="outline">
          em breve
        </Badge>
      </div>
    )
  }
  return (
    <div className={styles.placeholder} data-testid="user-menu">
      <span className={styles.avatar} aria-hidden="true">
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{user.name}</span>
        <span className={styles.role}>{user.role}</span>
      </span>
    </div>
  )
}
