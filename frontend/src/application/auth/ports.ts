// Portas da autenticação e da gestão de usuários (TASK-040; ADR-016 § 4). Implementadas pelos
// clientes REST de src/infrastructure/api; falham com `AuthRequestError`.

import type { AuthSession, User, UserRole } from '../../domain/auth/user'

export interface AuthGateway {
  /** `GET /auth/session`. */
  getSession(): Promise<AuthSession>
  /** `POST /auth/login` → o usuário logado (o cookie HttpOnly fica com o navegador). */
  login(username: string, password: string): Promise<User>
  /** `POST /auth/logout` (idempotente). */
  logout(): Promise<void>
}

export interface NewUser {
  readonly username: string
  readonly displayName: string
  readonly password: string
  readonly role: UserRole
}

/** Mudança parcial: só os campos presentes mudam. O `username` não muda. */
export interface UserChanges {
  readonly displayName?: string
  readonly role?: UserRole
  readonly active?: boolean
  readonly password?: string
}

export interface UsersGateway {
  list(): Promise<readonly User[]>
  create(user: NewUser): Promise<User>
  update(id: string, changes: UserChanges): Promise<User>
}
