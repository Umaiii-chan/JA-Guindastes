import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'

import {
  type AccessoryIds,
  addAccessory,
  removeAccessoryAt,
  resolveAccessories,
} from '../../application/accessory/accessorySelection'
import {
  ACCESSORY_TYPE_LABELS,
  type Accessory,
  MAX_SELECTED_ACCESSORIES,
} from '../../domain/accessory/accessory'
import { Badge, Button, Field, IconButton, Notice, Panel, Select, Spinner } from '../ui'
import styles from './accessoryPanel.module.css'

export type AccessoryCatalogStatus = 'loading' | 'loaded' | 'error'

export interface AccessoryPanelProps {
  /** Catálogo de acessórios do backend. */
  readonly catalog: readonly Accessory[]
  readonly status: AccessoryCatalogStatus
  /** Mensagem do erro ao carregar o catálogo. */
  readonly errorMessage?: string | null
  /** Cadeia escolhida, do gancho para a carga. */
  readonly selectedIds: AccessoryIds
  onChange(ids: AccessoryIds): void
  /** Acessórios com arquivo de modelo registrado, mas que não puderam ser carregados na cena. */
  readonly failedModelIds?: ReadonlySet<string>
  onRetry?(): void
}

const TITLE = 'Acessórios de içamento'

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

/**
 * Seleção dos acessórios entre o gancho e a carga (TASK-056; RN-014). Pode ser trocada a qualquer
 * momento: a avaliação do backend soma o peso, e a cena desce a carga pela soma das alturas. Os
 * números da soma aqui são só uma prévia (RN-008). Acessório sem modelo 3D mostra "modelo 3D
 * pendente": nesse caso ele entra só no peso e na distância.
 */
export function AccessoryPanel({
  catalog,
  status,
  errorMessage = null,
  selectedIds,
  onChange,
  failedModelIds,
  onRetry,
}: AccessoryPanelProps) {
  const [choice, setChoice] = useState('')
  const selectId = useId()
  const resolved = resolveAccessories(selectedIds, catalog)
  const full = selectedIds.length >= MAX_SELECTED_ACCESSORIES

  const add = () => {
    if (choice === '') return
    onChange(addAccessory(selectedIds, choice))
    setChoice('')
  }

  return (
    <Panel title={TITLE} stamp="ACESS.">
      <div className={styles.body}>
        {status === 'loading' && (
          <p className={styles.hint}>
            <Spinner size={12} /> Carregando acessórios…
          </p>
        )}
        {status === 'error' && (
          <Notice
            tone="warning"
            compact
            role="alert"
            title="Não foi possível carregar os acessórios"
          >
            {errorMessage ?? 'Falha ao falar com o servidor.'}{' '}
            {onRetry && (
              <Button size="sm" variant="ghost" onClick={onRetry}>
                Tentar de novo
              </Button>
            )}
          </Notice>
        )}
        {status === 'loaded' && catalog.length === 0 && (
          <p className={styles.hint}>Nenhum acessório cadastrado.</p>
        )}

        {catalog.length > 0 && (
          <div className={styles.addRow}>
            <Field label="Adicionar acessório" id={selectId}>
              <Select
                value={choice}
                disabled={full}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="">Escolha…</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {ACCESSORY_TYPE_LABELS[item.type]} · {formatNumber(item.weightKg)}{' '}
                    kg
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              size="md"
              variant="secondary"
              icon={<Plus size={14} />}
              disabled={choice === '' || full}
              onClick={add}
            >
              Adicionar
            </Button>
          </div>
        )}
        {full && <p className={styles.hint}>Limite de {MAX_SELECTED_ACCESSORIES} acessórios.</p>}

        {selectedIds.length === 0 ? (
          <p className={styles.hint}>Sem acessórios: a carga fica presa direto ao gancho.</p>
        ) : (
          <ol className={styles.chain} aria-label="Cadeia do gancho para a carga">
            {selectedIds.map((id, index) => {
              const accessory = catalog.find((item) => item.id === id)
              return (
                <li key={`${id}-${index}`} className={styles.item}>
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{accessory?.name ?? id}</span>
                    {accessory ? (
                      <span className={styles.itemMeta}>
                        {ACCESSORY_TYPE_LABELS[accessory.type]} · {formatNumber(accessory.weightKg)}{' '}
                        kg · {formatNumber(accessory.riggingHeightM)} m
                      </span>
                    ) : (
                      <span className={styles.itemMeta}>não está mais no catálogo</span>
                    )}
                    {accessory?.credit && (
                      <span className={styles.itemMeta}>
                        Modelo 3D: {accessory.credit}
                        {accessory.license ? ` · ${accessory.license}` : ''}
                      </span>
                    )}
                    {accessory &&
                      (accessory.modelFile === null || failedModelIds?.has(accessory.id)) && (
                        <Badge tone="warning" variant="outline">
                          modelo 3D pendente
                        </Badge>
                      )}
                  </div>
                  <IconButton
                    label={`Remover ${accessory?.name ?? id}`}
                    icon={<X size={14} />}
                    size="sm"
                    onClick={() => onChange(removeAccessoryAt(selectedIds, index))}
                  />
                </li>
              )
            })}
          </ol>
        )}

        {resolved.unknownIds.length > 0 && (
          <Notice tone="warning" compact title="Acessório fora do catálogo">
            O servidor não avalia a operação enquanto houver acessório que ele não conhece. Remova-o
            da cadeia.
          </Notice>
        )}

        {resolved.accessories.length > 0 && (
          <p className={styles.summary}>
            Prévia: {formatNumber(resolved.weightKg)} kg · a carga desce{' '}
            {formatNumber(resolved.riggingHeightM)} m. O peso comparado oficial vem do servidor.
          </p>
        )}
      </div>
    </Panel>
  )
}
