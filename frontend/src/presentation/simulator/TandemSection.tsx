import type { ReactNode } from 'react'

import type { CargoPlacement } from '../../domain/environment/environment'
import { TANDEM_CAPACITY_FACTOR } from '../../domain/tandem/tandem'
import { NumberField } from '../panels/NumberField'
import { Button, Notice, type Tone } from '../ui'
import styles from './TandemSection.module.css'

export interface TandemMessage {
  readonly tone: Extract<Tone, 'info' | 'warning' | 'danger' | 'ok'>
  readonly text: string
}

export interface TandemSectionProps {
  /** Há um segundo guindaste no cenário. */
  readonly hasSecondCrane: boolean
  /** A carga do passo Carga está válida (peso e medidas). */
  readonly loadReady: boolean
  /** Modo Tandem ligado. */
  readonly active: boolean
  /** Os dois ganchos estão presos à carga. */
  readonly engaged: boolean
  readonly cargo: CargoPlacement | null
  onActivate(): void
  onDeactivate(): void
  onCargoChange(cargo: CargoPlacement): void
  onEngage(): void
  onRelease(): void
  readonly message: TandemMessage | null
  /** Conteúdo extra do cabeçalho do modo (ex.: aviso de que a cena ainda carrega). */
  readonly children?: ReactNode
}

/**
 * Seção "Içamento com dois guindastes" da coluna do simulador (TASK-074; RN-016). Liga o modo
 * Tandem, posiciona a carga no chão e engata os dois ganchos nos pontos de içamento (nas
 * extremidades do comprimento, a 1/4 e 3/4). Com os dois engatados, o Guindaste 1 conduz e o 2
 * acompanha.
 */
export function TandemSection(props: TandemSectionProps) {
  const { hasSecondCrane, loadReady, active, engaged, cargo } = props
  const blocker = !hasSecondCrane
    ? 'Adicione um segundo guindaste em "Editar ambiente" → "Adicionar guindaste".'
    : !loadReady
      ? 'Informe a carga (peso e medidas) no passo "Carga".'
      : null

  return (
    <div className={styles.stack}>
      <p className={styles.intro}>
        Para cargas que um guindaste só não levanta. A carga se divide entre os dois pelos pontos de
        içamento, e cada um usa no máximo {TANDEM_CAPACITY_FACTOR * 100} % da própria capacidade.
      </p>
      {blocker !== null && (
        <Notice tone="info" compact>
          {blocker}
        </Notice>
      )}
      {blocker === null && !active && (
        <Button variant="primary" size="sm" onClick={props.onActivate}>
          Ativar modo Tandem
        </Button>
      )}
      {blocker === null && active && (
        <>
          <p className={styles.state}>
            {engaged
              ? 'Os dois ganchos estão presos à carga. Os controles do Guindaste 1 movem os dois.'
              : 'Posicione a carga no chão e engate os ganchos nos pontos marcados.'}
          </p>
          {cargo !== null && (
            <fieldset className={styles.fields} disabled={engaged}>
              <legend className={styles.legend}>Posição da carga no chão</legend>
              <NumberField
                label="X"
                unit="m"
                value={cargo.x}
                onCommit={(x) => props.onCargoChange({ ...cargo, x })}
              />
              <NumberField
                label="Z"
                unit="m"
                value={cargo.z}
                onCommit={(z) => props.onCargoChange({ ...cargo, z })}
              />
              <NumberField
                label="Giro"
                unit="°"
                value={cargo.rotationYDeg}
                onCommit={(rotationYDeg) => props.onCargoChange({ ...cargo, rotationYDeg })}
              />
            </fieldset>
          )}
          <div className={styles.actions}>
            {engaged ? (
              <Button variant="secondary" size="sm" onClick={props.onRelease}>
                Soltar a carga
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={props.onEngage}>
                Engatar e sincronizar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={props.onDeactivate}>
              Desativar o modo Tandem
            </Button>
          </div>
        </>
      )}
      {props.message !== null && (
        <Notice tone={props.message.tone} compact role="status">
          {props.message.text}
        </Notice>
      )}
      {props.children}
    </div>
  )
}
