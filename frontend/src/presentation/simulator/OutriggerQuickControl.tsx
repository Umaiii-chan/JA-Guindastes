import { ArrowDownToLine } from 'lucide-react'

import { type OutriggerState, outriggersReady } from '../../domain/crane/outriggers'
import { Button, cx } from '../ui'
import { useSimulatorLayout } from './layout/simulatorLayout'
import styles from './OutriggerQuickControl.module.css'

export interface OutriggerQuickControlProps {
  /** Comando: o que a pessoa pediu. */
  readonly state: OutriggerState
  /** O que a animação da cena já alcançou (TASK-093); padrão: o próprio comando. */
  readonly reached?: OutriggerState
  /** A cena ainda anima as patolas até o comando. */
  readonly moving?: boolean
  /** Correção máxima dos macacos (graus), a mesma do painel Patolas. */
  readonly maxLevelingDeg: number
  onChange(state: OutriggerState): void
  /** Abre o painel Patolas (passo Posição); a folha "Configurar" é aberta aqui. */
  onShowPanel?(): void
}

/**
 * Estado das patolas na barra de comando do simulador (TASK-095): diz se estão prontas e oferece o
 * "Apoiar e nivelar" sem abrir o painel. O painel completo (estender, recolher, nivelamento e avisos)
 * continua no passo Posição; o botão de estado leva até ele.
 */
export function OutriggerQuickControl({
  state,
  reached,
  moving = false,
  maxLevelingDeg,
  onChange,
  onShowPanel,
}: OutriggerQuickControlProps) {
  const layout = useSimulatorLayout()
  // O estado à vista é o alcançado na cena, como no painel Patolas e na avaliação (TASK-093).
  const shown = reached ?? state
  const ready = outriggersReady(shown)
  const extension = shown.extensionPercent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  const summary = moving
    ? `${extension} % · em movimento`
    : ready
      ? 'prontas'
      : `${extension} % · ${shown.jacksSet ? 'apoiadas' : 'não apoiadas'}`
  const showPanel = () => {
    onShowPanel?.()
    layout?.openSheet('setup')
  }
  return (
    <div className={styles.quick} role="group" aria-label="Estado das patolas">
      <button
        type="button"
        className={cx(styles.state, ready ? styles.ready : styles.notReady)}
        title="Abrir o painel das patolas (passo Posição)"
        onClick={showPanel}
      >
        <span className={styles.caption}>Patolas</span>
        <span className={styles.value}>{summary}</span>
      </button>
      {!outriggersReady(state) && (
        <Button
          size="sm"
          icon={<ArrowDownToLine size={13} />}
          onClick={() =>
            onChange({ extensionPercent: 100, jacksSet: true, levelingDeg: maxLevelingDeg })
          }
        >
          Apoiar e nivelar
        </Button>
      )}
    </div>
  )
}
