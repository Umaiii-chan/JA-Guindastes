import { useId } from 'react'

import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'
import { Badge } from '../ui'
import styles from './panels.module.css'

interface OperationalGeometryPanelProps {
  /** `null` enquanto a cena não montou. */
  geometry: OperationalGeometry | null
  /** Parâmetros a e h usados no cálculo. */
  parameters: CraneGeometryParameters | null
  /** `true` se a e h vieram da ficha técnica da configuração; `false`, FICTÍCIOS (TASK-033). */
  parametersFromSheet?: boolean
}

function formatMeters(value: number): string {
  const number = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${number} m`
}

/**
 * Raio de trabalho e alturas da ponta e do gancho calculados no navegador (ADR-013 C-5), só como
 * PRÉ-VISUALIZAÇÃO: o valor oficial é o do backend, e capacidade e segurança não são decididas no
 * frontend (ADR-013 C-7; RN-008).
 */
export function OperationalGeometryPanel({ geometry }: OperationalGeometryPanelProps) {
  const titleId = `${useId()}-title`

  const rows = [
    {
      label: 'Raio de trabalho',
      value: geometry?.workingRadiusM,
      // ADR-013 C-5: com a ponta atrás do eixo de giro o raio não vira |R|.
      whenNull: 'fora do domínio',
    },
    { label: 'Altura da ponta', value: geometry?.tipHeightM, whenNull: '—' },
    { label: 'Altura do gancho', value: geometry?.hookHeightM, whenNull: '—' },
  ]

  return (
    <section className={styles.geometry} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.geometryTitle}>
        Geometria <Badge tone="neutral">prévia</Badge>
      </h2>
      <dl className={styles.geometryValues}>
        {rows.map((row) => (
          <div className={styles.geometryCell} key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {geometry === null
                ? '—'
                : row.value === null || row.value === undefined
                  ? row.whenNull
                  : formatMeters(row.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.fineprint}>Prévia; o valor oficial é o da avaliação.</p>
    </section>
  )
}
