import { useId } from 'react'

import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'

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
export function OperationalGeometryPanel({
  geometry,
  parameters,
  parametersFromSheet = false,
}: OperationalGeometryPanelProps) {
  const titleId = `${useId()}-title`

  const rows = [
    {
      label: 'Raio de trabalho',
      value: geometry?.workingRadiusM,
      // ADR-013 C-5: com a ponta atrás do eixo de giro o raio não vira |R|.
      whenNull: 'fora do domínio geométrico (ponta atrás do eixo de giro)',
    },
    { label: 'Altura da ponta', value: geometry?.tipHeightM, whenNull: '—' },
    { label: 'Altura do gancho', value: geometry?.hookHeightM, whenNull: '—' },
  ]

  return (
    <section className="geometry-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>
        Geometria <span className="geometry-panel__badge">pré-visualização — frontend</span>
      </h2>
      <dl className="geometry-panel__values">
        {rows.map((row) => (
          <div className="geometry-panel__row" key={row.label}>
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
      <p className="geometry-panel__notice">
        Calculada no navegador pelas fórmulas do ADR-013, com parâmetros{' '}
        {parametersFromSheet ? 'da ficha técnica da configuração' : 'FICTÍCIOS'}
        {parameters && (
          <>
            {' '}
            (pino da lança: a = {formatMeters(parameters.boomPivotOffsetM)}, h ={' '}
            {formatMeters(parameters.boomPivotHeightM)})
          </>
        )}
        . Raio geométrico, sem deflexão da lança. Não é o valor oficial: capacidade e segurança não
        são decididas no frontend, e quem valida a operação é o backend.
      </p>
    </section>
  )
}
