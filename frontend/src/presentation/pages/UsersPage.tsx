import {
  DatabaseZap,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { UsersGateway } from '../../application/auth/ports'
import { AuthRequestError, ROLE_LABEL, type User } from '../../domain/auth/user'
import { Page } from '../layout/Page'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Notice,
  Panel,
  StatusPill,
  Table,
  type TableColumn,
  useToast,
} from '../ui'
import { type UserFormTarget, UserFormDrawer } from '../users/UserFormDrawer'
import { type ExplainedUserError, explainUserError } from '../users/userErrors'
import styles from './UsersPage.module.css'

export interface UsersPageProps {
  /** `disabled`: modo sem banco (ADR-016 § 5), sem contas para gerenciar. */
  readonly mode: 'enabled' | 'disabled'
  readonly gateway: UsersGateway
  /** Id do admin logado (para as proteções da própria conta). */
  readonly currentUserId: string | null
}

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly items: readonly User[] }
  | { readonly status: 'error'; readonly message: string }

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE_FORMAT.format(date)
}

/** Texto para a busca: minúsculas e sem acentos. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Usuários (ADR-017 § 1; TASK-040 CA-4), só ADMIN: tabela com busca, criar e editar num `Drawer`,
 * confirmação antes de desativar e os erros 409 (`USERNAME_TAKEN`, `LAST_ADMIN`, `OWN_ADMIN_ACCESS`)
 * explicados.
 */
export function UsersPage({ mode, gateway, currentUserId }: UsersPageProps) {
  if (mode === 'disabled') {
    return (
      <Page width="narrow">
        <Panel title="Usuários" icon={<Users size={16} />}>
          <EmptyState
            icon={<DatabaseZap size={24} />}
            tone="warning"
            title="Modo sem autenticação (sem banco)"
            description="O backend está sem banco de dados: não há login nem contas. A gestão de usuários só existe com o banco ligado."
          />
        </Panel>
      </Page>
    )
  }
  return <UsersManager gateway={gateway} currentUserId={currentUserId} />
}

function UsersManager({
  gateway,
  currentUserId,
}: {
  readonly gateway: UsersGateway
  readonly currentUserId: string | null
}) {
  const toast = useToast()
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<UserFormTarget | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [confirming, setConfirming] = useState<User | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [toggleFailure, setToggleFailure] = useState<ExplainedUserError | null>(null)

  useEffect(() => {
    let cancelled = false
    gateway.list().then(
      (items) => {
        if (!cancelled) setList({ status: 'loaded', items })
      },
      (error: unknown) => {
        if (!cancelled) {
          setList({ status: 'error', message: error instanceof Error ? error.message : '' })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [gateway, attempt])

  const reload = useCallback(() => {
    setList({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const replaceUser = (user: User) =>
    setList((current) => {
      if (current.status !== 'loaded') return current
      const exists = current.items.some((item) => item.id === user.id)
      const items = exists
        ? current.items.map((item) => (item.id === user.id ? user : item))
        : [...current.items, user].sort((a, b) => a.username.localeCompare(b.username))
      return { status: 'loaded', items }
    })

  const openForm = (next: UserFormTarget) => {
    setToggleFailure(null)
    setFormKey((value) => value + 1)
    setTarget(next)
  }

  async function setActive(user: User, active: boolean) {
    setToggleFailure(null)
    setToggling(user.id)
    try {
      const saved = await gateway.update(user.id, { active })
      replaceUser(saved)
      toast.show({
        tone: active ? 'ok' : 'info',
        title: active ? `${saved.displayName} reativado` : `${saved.displayName} desativado`,
        description: active
          ? 'A conta volta a entrar no simulador.'
          : 'A conta não entra mais e as sessões abertas foram encerradas.',
      })
    } catch (error) {
      if (!(error instanceof AuthRequestError)) throw error
      setToggleFailure(explainUserError(error))
      if (error.code === 'USER_NOT_FOUND') reload()
    } finally {
      setToggling(null)
      setConfirming(null)
    }
  }

  const items = useMemo(() => (list.status === 'loaded' ? list.items : []), [list])
  const filtered = useMemo(() => {
    const needle = normalize(query.trim())
    if (needle === '') return items
    return items.filter(
      (user) =>
        normalize(user.username).includes(needle) || normalize(user.displayName).includes(needle),
    )
  }, [items, query])

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      header: 'Usuário',
      render: (user) => (
        <span className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.names}>
            <span className={styles.displayName}>
              {user.displayName}
              {user.id === currentUserId && (
                <Badge tone="info" variant="outline">
                  você
                </Badge>
              )}
            </span>
            <span className={styles.username}>@{user.username}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Perfil',
      render: (user) => (
        <Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>
      ),
    },
    {
      key: 'active',
      header: 'Situação',
      render: (user) => (
        <StatusPill tone={user.active ? 'ok' : 'neutral'} size="sm">
          {user.active ? 'Ativo' : 'Inativo'}
        </StatusPill>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      numeric: true,
      render: (user) => <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>,
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">Ações</span>,
      render: (user) => {
        const self = user.id === currentUserId
        return (
          <span className={styles.actions}>
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil size={14} />}
              aria-label={`Editar ${user.displayName}`}
              onClick={() => openForm({ kind: 'edit', user, isSelf: self })}
            >
              Editar
            </Button>
            {user.active ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<PowerOff size={14} />}
                aria-label={`Desativar ${user.displayName}`}
                disabled={self || toggling === user.id}
                title={self ? 'Você não pode desativar a própria conta.' : undefined}
                onClick={() => {
                  setToggleFailure(null)
                  setConfirming(user)
                }}
              >
                Desativar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Power size={14} />}
                aria-label={`Reativar ${user.displayName}`}
                loading={toggling === user.id}
                onClick={() => void setActive(user, true)}
              >
                Reativar
              </Button>
            )}
          </span>
        )
      },
    },
  ]

  const activeAdmins = items.filter((user) => user.active && user.role === 'ADMIN').length

  return (
    <Page
      intro="Só administradores veem esta página. Não há cadastro aberto: cada conta é criada aqui, com o perfil certo."
      actions={
        <Button
          variant="primary"
          icon={<UserPlus size={16} />}
          onClick={() => openForm({ kind: 'create' })}
        >
          Novo usuário
        </Button>
      }
    >
      {toggleFailure && (
        <Notice tone="danger" role="alert" title={toggleFailure.title}>
          {toggleFailure.message}
        </Notice>
      )}
      <Panel
        title="Contas"
        subtitle={
          list.status === 'loaded'
            ? `${items.length} ${items.length === 1 ? 'conta' : 'contas'} · ${activeAdmins} ${activeAdmins === 1 ? 'administrador ativo' : 'administradores ativos'}`
            : 'Carregando…'
        }
        icon={<Users size={16} />}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={14} />}
            onClick={reload}
            disabled={list.status === 'loading'}
          >
            Recarregar
          </Button>
        }
        flush
      >
        <div className={styles.toolbar}>
          <Field label="Buscar" className={styles.search}>
            <Input
              type="search"
              placeholder="Nome ou usuário"
              leadingIcon={<Search size={15} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </div>
        {list.status === 'error' ? (
          <EmptyState
            role="alert"
            tone="danger"
            icon={<Users size={24} />}
            title="Não foi possível ler as contas"
            description={list.message}
            action={
              <Button variant="primary" icon={<RefreshCw size={16} />} onClick={reload}>
                Tentar de novo
              </Button>
            }
          />
        ) : (
          <Table
            caption="Contas de usuário"
            columns={columns}
            rows={filtered}
            rowKey={(user) => user.id}
            loading={list.status === 'loading'}
            className={styles.table}
            empty={
              <EmptyState
                compact
                tone="neutral"
                icon={<Search size={22} />}
                title={query ? 'Nenhuma conta encontrada' : 'Nenhuma conta'}
                description={
                  query
                    ? `Nada corresponde a "${query}".`
                    : 'Crie a primeira conta pelo botão acima.'
                }
              />
            }
          />
        )}
      </Panel>

      {target && (
        <UserFormDrawer
          key={formKey}
          target={target}
          gateway={gateway}
          onClose={() => setTarget(null)}
          onNotFound={reload}
          onSaved={(user, kind) => {
            replaceUser(user)
            setTarget(null)
            toast.show({
              tone: 'ok',
              title: kind === 'create' ? `Conta @${user.username} criada` : 'Alterações salvas',
              description:
                kind === 'create'
                  ? `Perfil ${ROLE_LABEL[user.role]}. Entregue a senha à pessoa por um canal seguro.`
                  : `${user.displayName} · ${ROLE_LABEL[user.role]}`,
            })
          }}
        />
      )}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        size="sm"
        title="Desativar conta?"
        description={
          confirming
            ? `${confirming.displayName} (@${confirming.username}) não vai mais conseguir entrar, e as sessões abertas dessa conta são encerradas. Dá para reativar depois.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={<PowerOff size={16} />}
              loading={confirming !== null && toggling === confirming.id}
              onClick={() => confirming && void setActive(confirming, false)}
            >
              Desativar
            </Button>
          </>
        }
      />
    </Page>
  )
}
