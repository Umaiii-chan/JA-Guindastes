import { ChevronRight } from 'lucide-react'

import { cx } from '../../ui'
import styles from './ContextChip.module.css'

export interface SimulatorSetupSummary {
  /** Guindaste escolhido ("Modelo · Configuração"), ou vazio. */
  readonly crane: string
  /** Peso da carga ("3.000 kg"), ou vazio enquanto a carga não for válida. */
  readonly load: string
  /** Passos concluídos e o total ("2 de 3"). */
  readonly done: number
  readonly total: number
  /** Falta escolher o guindaste ou descrever a carga: a folha "Configurar" abre sozinha. */
  readonly incomplete: boolean
}

export interface ContextChipProps {
  readonly summary: SimulatorSetupSummary
  readonly expanded: boolean
  /** Id da folha "Configurar". */
  readonly controls: string
  onOpen(): void
}

/**
 * Chip de contexto no topo da cena (TASK-095; ADR-042): o resumo dos passos 01 e 02 (guindaste e
 * carga) e o progresso; clicar abre a folha "Configurar".
 */
export function ContextChip({ summary, expanded, controls, onOpen }: ContextChipProps) {
  const parts = [summary.crane, summary.load].filter((part) => part !== '')
  const text = parts.length > 0 ? parts.join(' · ') : 'Escolha o guindaste e descreva a carga'
  return (
    <button
      type="button"
      className={cx(styles.chip, summary.incomplete && styles.incomplete)}
      aria-expanded={expanded}
      aria-controls={controls}
      title="Abrir a simulação guiada"
      onClick={onOpen}
    >
      <span className={styles.caption}>Operação</span>
      <span className={styles.text}>{text}</span>
      <span className={styles.progress}>
        {summary.done}/{summary.total}
        <span className="visually-hidden"> passos concluídos</span>
      </span>
      <ChevronRight size={14} aria-hidden="true" className={styles.chevron} />
    </button>
  )
}
