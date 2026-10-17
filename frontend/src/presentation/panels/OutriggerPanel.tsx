import { ArrowDownToLine, ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react'

import { type OutriggerState, outriggersReady } from '../../domain/crane/outriggers'
import { Button, Notice, Slider } from '../ui'
import styles from './panels.module.css'

interface OutriggerPanelProps {
  /** Comando: o que a pessoa pediu (o controle deslizante e os botões partem dele). */
  state: OutriggerState
  /**
   * O que a animação da cena já alcançou (TASK-093): é o que o aviso de "prontas" e o texto dos
   * macacos mostram, e o que vai à avaliação. Padrão: o próprio comando (sem cena).
   */
  reached?: OutriggerState
  /** `true` enquanto a cena ainda anima as patolas até o comando. */
  moving?: boolean
  /** Correção máxima dos macacos (graus). FICTÍCIA até o catálogo trazer `max_leveling_deg`. */
  maxLevelingDeg: number
  /** `true` quando o modelo 3D tem as patolas modeladas; senão, a cena não as desenha. */
  modelAvailable?: boolean
  onChange: (state: OutriggerState) => void
}

/** Patolas (TASK-054; RN-013): estender/recolher, apoiar e nivelar, com aviso de "não prontas". */
export function OutriggerPanel({
  state,
  reached,
  moving = false,
  maxLevelingDeg,
  modelAvailable = false,
  onChange,
}: OutriggerPanelProps) {
  const shown = reached ?? state
  const ready = outriggersReady(shown)
  const extend = () => onChange({ ...state, extensionPercent: 100 })
  const retract = () => onChange({ extensionPercent: 0, jacksSet: false, levelingDeg: 0 })
  const setAndLevel = () =>
    onChange({ extensionPercent: 100, jacksSet: true, levelingDeg: maxLevelingDeg })

  return (
    <section className={styles.stack} aria-label="Patolas">
      <Slider
        label="Extensão das patolas"
        value={state.extensionPercent}
        min={0}
        max={100}
        step={1}
        format={(value) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} %`}
        onChange={(value) =>
          onChange(
            value < 100
              ? { extensionPercent: value, jacksSet: false, levelingDeg: 0 }
              : { ...state, extensionPercent: value },
          )
        }
      />
      <div className={styles.grid3}>
        <Button
          size="sm"
          icon={<ChevronsLeftRight size={14} />}
          onClick={extend}
          disabled={state.extensionPercent >= 100}
        >
          Estender
        </Button>
        <Button
          size="sm"
          icon={<ChevronsRightLeft size={14} />}
          onClick={retract}
          disabled={state.extensionPercent <= 0 && !state.jacksSet}
        >
          Recolher
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<ArrowDownToLine size={14} />}
          onClick={setAndLevel}
          disabled={outriggersReady(state) && state.levelingDeg >= maxLevelingDeg}
        >
          Apoiar e nivelar
        </Button>
      </div>
      <p className={styles.fieldStatus}>
        Macacos {shown.jacksSet ? 'apoiados' : 'recolhidos'} · nivelamento{' '}
        {shown.levelingDeg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}° de até{' '}
        {maxLevelingDeg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}°
        {moving && ' · em movimento'}
      </p>
      {ready ? (
        <Notice tone="ok" compact role="status" title="Patolas prontas">
          Estendidas a 100 % e apoiadas, como a tabela de carga pressupõe.
        </Notice>
      ) : (
        <Notice tone="warning" compact role="status" title="Patolas não prontas">
          A tabela de carga pressupõe patolas estendidas a 100 % e apoiadas. Até lá, o resultado não
          vale para a operação.
        </Notice>
      )}
      {!modelAvailable && (
        <p className={styles.sourceNote}>
          <span>
            O modelo 3D atual não traz as patolas: o estado é enviado ao servidor, mas a cena ainda
            não as desenha.
          </span>
        </p>
      )}
    </section>
  )
}
