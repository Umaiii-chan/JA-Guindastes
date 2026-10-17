import { FolderOpen, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  addFeature,
  addObstacle,
  addPowerLine,
  FEATURE_KIND_LABELS,
  MAX_OBSTACLES,
  MAX_POWER_LINES,
  MAX_TERRAIN_FEATURES,
  OBSTACLE_KIND_LABELS,
  type PrimitiveObstacleKind,
  removeFeature,
  removeObstacle,
  removePowerLine,
  SLOPE_PERCENT_LIMIT,
  updateFeature,
  updateObstacle,
  updatePowerLine,
  withCranePlacement,
  withSlope,
} from '../../application/environment/scenarioEditing'
import type { ScenarioSummary } from '../../application/environment/ports'
import type { Obstacle, ScenarioSpec, TerrainFeature } from '../../domain/environment/environment'
import {
  formatVoltageKv,
  POWER_LINE_MAX_HEIGHT_M,
  POWER_LINE_MAX_KV,
  POWER_LINE_MIN_HEIGHT_M,
  POWER_LINE_VOLTAGE_OPTIONS_KV,
  type PowerLine,
  requiredClearanceM,
} from '../../domain/environment/powerLine'
import { Button, Field, IconButton, Input, Notice, Select } from '../ui'
import styles from './environment.module.css'
import { NumberField } from './NumberField'

export interface EnvironmentPanelProps {
  /** Cenário em edição, o que a cena desenha. */
  readonly spec: ScenarioSpec
  onChange(spec: ScenarioSpec): void
  /** Inclinação sob as sapatas FICTÍCIAS, em graus; `undefined` com terreno plano. */
  readonly groundSlopeDeg: number | undefined
  readonly scenarios: readonly ScenarioSummary[]
  /** Cenário salvo aberto, ou `null`. */
  readonly current: ScenarioSummary | null
  /** O usuário pode atualizar e apagar o cenário aberto (é o autor ou admin). */
  readonly canEditCurrent: boolean
  /** O usuário é o autor do cenário (ou admin): usado na lista para saber quem pode apagar. */
  canEdit(scenario: ScenarioSummary): boolean
  readonly dirty: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly info: string | null
  onOpen(id: string): void
  onSave(name: string, options: { readonly asNew: boolean }): void
  onRemove(id: string): void
  onReset(): void
}

const FEATURE_KINDS: readonly TerrainFeature['kind'][] = ['mound', 'pit', 'plateau', 'ramp']
const OBSTACLE_KINDS: readonly PrimitiveObstacleKind[] = ['box', 'cylinder']

function FeatureEditor({
  feature,
  onChange,
  onRemove,
}: {
  readonly feature: TerrainFeature
  onChange(changes: Partial<Omit<TerrainFeature, 'id' | 'kind'>>): void
  onRemove(): void
}) {
  return (
    <fieldset
      className={styles.item}
      aria-label={`${FEATURE_KIND_LABELS[feature.kind]} ${feature.id}`}
    >
      <legend className={styles.itemLegend}>
        {FEATURE_KIND_LABELS[feature.kind]} <span className={styles.itemId}>{feature.id}</span>
      </legend>
      <IconButton
        className={styles.itemRemove}
        label={`Remover ${FEATURE_KIND_LABELS[feature.kind].toLowerCase()} ${feature.id}`}
        icon={<Trash2 size={14} />}
        size="sm"
        onClick={onRemove}
      />
      <div className={styles.grid2}>
        <NumberField
          label="Centro X (m)"
          unit="m"
          value={feature.centerX}
          onCommit={(centerX) => onChange({ centerX })}
        />
        <NumberField
          label="Centro Z (m)"
          unit="m"
          value={feature.centerZ}
          onCommit={(centerZ) => onChange({ centerZ })}
        />
        <NumberField
          label={feature.kind === 'ramp' ? 'Meio comprimento (m)' : 'Raio (m)'}
          unit="m"
          positive
          value={feature.radiusM}
          onCommit={(radiusM) => onChange({ radiusM })}
        />
        <NumberField
          label={feature.kind === 'flatten' ? 'Nível (m)' : 'Altura (m)'}
          unit="m"
          nonNegative={feature.kind !== 'flatten'}
          value={feature.heightM}
          onCommit={(heightM) => onChange({ heightM })}
        />
        {feature.kind === 'ramp' && (
          <>
            <NumberField
              label="Direção (°)"
              unit="°"
              value={feature.directionDeg ?? 0}
              onCommit={(directionDeg) => onChange({ directionDeg })}
            />
            <NumberField
              label="Largura (m)"
              unit="m"
              positive
              value={feature.widthM ?? feature.radiusM}
              onCommit={(widthM) => onChange({ widthM })}
            />
          </>
        )}
      </div>
    </fieldset>
  )
}

/**
 * Trecho de rede elétrica (TASK-107; ADR-051): a tensão é escolhida na lista (ou digitada) e define
 * a distância mínima da Tabela A do OSHA 1926.1408 (ADR-051), que o backend confere contra a lança, o cabo e a carga.
 */
function PowerLineEditor({
  line,
  onChange,
  onRemove,
}: {
  readonly line: PowerLine
  onChange(changes: Partial<Omit<PowerLine, 'id'>>): void
  onRemove(): void
}) {
  const clearance = requiredClearanceM(line.voltageKv)
  const options = POWER_LINE_VOLTAGE_OPTIONS_KV.includes(line.voltageKv)
    ? POWER_LINE_VOLTAGE_OPTIONS_KV
    : [...POWER_LINE_VOLTAGE_OPTIONS_KV, line.voltageKv].sort((a, b) => a - b)
  return (
    <fieldset className={styles.item} aria-label={`Rede elétrica ${line.id}`}>
      <legend className={styles.itemLegend}>
        Rede elétrica <span className={styles.itemId}>{line.id}</span>
      </legend>
      <IconButton
        className={styles.itemRemove}
        label={`Remover rede elétrica ${line.id}`}
        icon={<Trash2 size={14} />}
        size="sm"
        onClick={onRemove}
      />
      <Field label="Nome">
        <Input
          type="text"
          autoComplete="off"
          value={line.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </Field>
      <Field label="Tensão">
        <Select
          value={String(line.voltageKv)}
          onChange={(event) => onChange({ voltageKv: Number(event.currentTarget.value) })}
        >
          {options.map((kv) => (
            <option key={kv} value={String(kv)}>
              {formatVoltageKv(kv)}
            </option>
          ))}
        </Select>
      </Field>
      <p className={styles.fineprint} role="status">
        {clearance === null
          ? 'Tensão fora da tabela.'
          : `Distância mínima: ${clearance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m (OSHA 1926.1408, Tabela A).`}
      </p>
      <div className={styles.grid2}>
        <NumberField
          label="Início X (m)"
          unit="m"
          value={line.x1M}
          onCommit={(x1M) => onChange({ x1M })}
        />
        <NumberField
          label="Início Z (m)"
          unit="m"
          value={line.z1M}
          onCommit={(z1M) => onChange({ z1M })}
        />
        <NumberField
          label="Fim X (m)"
          unit="m"
          value={line.x2M}
          onCommit={(x2M) => onChange({ x2M })}
        />
        <NumberField
          label="Fim Z (m)"
          unit="m"
          value={line.z2M}
          onCommit={(z2M) => onChange({ z2M })}
        />
        <NumberField
          label="Altura (m)"
          unit="m"
          min={POWER_LINE_MIN_HEIGHT_M}
          max={POWER_LINE_MAX_HEIGHT_M}
          value={line.heightM}
          onCommit={(heightM) => onChange({ heightM })}
        />
        <NumberField
          label="Tensão (kV)"
          unit="kV"
          positive
          max={POWER_LINE_MAX_KV}
          value={line.voltageKv}
          onCommit={(voltageKv) => onChange({ voltageKv })}
        />
      </div>
    </fieldset>
  )
}

function ObstacleEditor({
  obstacle,
  onChange,
  onRemove,
}: {
  readonly obstacle: Obstacle
  onChange(changes: Partial<Omit<Obstacle, 'id' | 'kind' | 'modelId'>>): void
  onRemove(): void
}) {
  const isBox = obstacle.kind !== 'cylinder'
  return (
    <fieldset
      className={styles.item}
      aria-label={`${OBSTACLE_KIND_LABELS[obstacle.kind]} ${obstacle.id}`}
    >
      <legend className={styles.itemLegend}>
        {OBSTACLE_KIND_LABELS[obstacle.kind]} <span className={styles.itemId}>{obstacle.id}</span>
      </legend>
      <IconButton
        className={styles.itemRemove}
        label={`Remover ${OBSTACLE_KIND_LABELS[obstacle.kind].toLowerCase()} ${obstacle.id}`}
        icon={<Trash2 size={14} />}
        size="sm"
        onClick={onRemove}
      />
      <Field label="Nome">
        <Input
          type="text"
          autoComplete="off"
          value={obstacle.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </Field>
      <div className={styles.grid2}>
        <NumberField
          label="Centro X (m)"
          unit="m"
          value={obstacle.centerX}
          onCommit={(centerX) => onChange({ centerX })}
        />
        <NumberField
          label="Centro Z (m)"
          unit="m"
          value={obstacle.centerZ}
          onCommit={(centerZ) => onChange({ centerZ })}
        />
        <NumberField
          label={isBox ? 'Largura (m)' : 'Diâmetro (m)'}
          unit="m"
          positive
          value={obstacle.widthM}
          onCommit={(widthM) => onChange({ widthM })}
        />
        {isBox && (
          <NumberField
            label="Profundidade (m)"
            unit="m"
            positive
            value={obstacle.depthM}
            onCommit={(depthM) => onChange({ depthM })}
          />
        )}
        <NumberField
          label="Altura (m)"
          unit="m"
          positive
          value={obstacle.heightM}
          onCommit={(heightM) => onChange({ heightM })}
        />
        {isBox && (
          <NumberField
            label="Giro (°)"
            unit="°"
            value={obstacle.rotationYDeg}
            onCommit={(rotationYDeg) => onChange({ rotationYDeg })}
          />
        )}
      </div>
    </fieldset>
  )
}

/**
 * Painel "Ambiente" do simulador (TASK-052; ADR-023): inclinação do terreno, feições (elevação,
 * depressão, platô e rampa), obstáculos de caixa e cilindro e a posição do guindaste, tudo por
 * campos numéricos, mais salvar, abrir e apagar cenários. Valores FICTÍCIOS; a cena só desenha, e o
 * `ground_slope_deg` enviado à avaliação ainda não é usado pelo backend.
 */
export function EnvironmentPanel({
  spec,
  onChange,
  groundSlopeDeg,
  scenarios,
  current,
  canEditCurrent,
  canEdit,
  dirty,
  busy,
  error,
  info,
  onOpen,
  onSave,
  onRemove,
  onReset,
}: EnvironmentPanelProps) {
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? null
  const saveName = name.trim() !== '' ? name.trim() : (current?.name ?? '')

  return (
    <div className={styles.panel}>
      <Notice tone="info" compact>
        A inclinação do terreno sob o guindaste entra no risco de tombamento.
      </Notice>

      <section className={styles.section} aria-labelledby="env-saved">
        <h3 id="env-saved" className={styles.heading}>
          Cenários salvos
        </h3>
        <p className={styles.status} role="status">
          {current
            ? `Aberto: ${current.name}${dirty ? ' (alterado, não salvo)' : ''}`
            : 'Cenário novo, ainda não salvo.'}
        </p>
        <div className={styles.row}>
          <Field label="Cenário" className={styles.grow}>
            <Select
              value={selectedId}
              onChange={(event) => setSelectedId(event.currentTarget.value)}
            >
              <option value="">Escolha um cenário salvo</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className={styles.actions}>
          <Button
            size="sm"
            icon={<FolderOpen size={13} />}
            disabled={selected === null || busy}
            onClick={() => selected && onOpen(selected.id)}
          >
            Abrir
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 size={13} />}
            disabled={selected === null || busy || !canEdit(selected)}
            title={
              selected !== null && !canEdit(selected)
                ? 'Só o autor do cenário ou um admin pode apagá-lo.'
                : undefined
            }
            onClick={() => selected && onRemove(selected.id)}
          >
            Apagar
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onReset}>
            Novo cenário
          </Button>
        </div>
        <Field label="Nome do cenário">
          <Input
            type="text"
            autoComplete="off"
            placeholder={current?.name ?? 'ex.: Pátio com rampa'}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Field>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="primary"
            icon={<Save size={13} />}
            disabled={busy || saveName === '' || (current !== null && !canEditCurrent)}
            title={
              current !== null && !canEditCurrent
                ? 'Só o autor do cenário ou um admin pode atualizá-lo: use "Salvar como novo".'
                : undefined
            }
            onClick={() => onSave(saveName, { asNew: false })}
          >
            {current ? 'Salvar alterações' : 'Salvar'}
          </Button>
          {current && (
            <Button
              size="sm"
              disabled={busy || saveName === ''}
              onClick={() => onSave(saveName, { asNew: true })}
            >
              Salvar como novo
            </Button>
          )}
        </div>
        {error && (
          <Notice tone="danger" role="alert" compact>
            {error}
          </Notice>
        )}
        {info && !error && (
          <Notice tone="ok" role="status" compact>
            {info}
          </Notice>
        )}
      </section>

      <section className={styles.section} aria-labelledby="env-terrain">
        <h3 id="env-terrain" className={styles.heading}>
          Terreno
        </h3>
        <div className={styles.grid2}>
          <NumberField
            label="Inclinação em X (%)"
            unit="%"
            min={-SLOPE_PERCENT_LIMIT}
            max={SLOPE_PERCENT_LIMIT}
            value={spec.terrain.slopeXPercent}
            onCommit={(value) => onChange(withSlope(spec, 'slopeXPercent', value))}
          />
          <NumberField
            label="Inclinação em Z (%)"
            unit="%"
            min={-SLOPE_PERCENT_LIMIT}
            max={SLOPE_PERCENT_LIMIT}
            value={spec.terrain.slopeZPercent}
            onCommit={(value) => onChange(withSlope(spec, 'slopeZPercent', value))}
          />
        </div>
        {spec.terrain.features.map((feature) => (
          <FeatureEditor
            key={feature.id}
            feature={feature}
            onChange={(changes) => onChange(updateFeature(spec, feature.id, changes))}
            onRemove={() => onChange(removeFeature(spec, feature.id))}
          />
        ))}
        <div className={styles.actions} role="group" aria-label="Adicionar feição ao terreno">
          {FEATURE_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              icon={<Plus size={13} />}
              disabled={spec.terrain.features.length >= MAX_TERRAIN_FEATURES}
              onClick={() => onChange(addFeature(spec, kind))}
            >
              {FEATURE_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="env-obstacles">
        <h3 id="env-obstacles" className={styles.heading}>
          Obstáculos
        </h3>
        {spec.obstacles.map((obstacle) => (
          <ObstacleEditor
            key={obstacle.id}
            obstacle={obstacle}
            onChange={(changes) => onChange(updateObstacle(spec, obstacle.id, changes))}
            onRemove={() => onChange(removeObstacle(spec, obstacle.id))}
          />
        ))}
        <div className={styles.actions} role="group" aria-label="Adicionar obstáculo">
          {OBSTACLE_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              icon={<Plus size={13} />}
              disabled={spec.obstacles.length >= MAX_OBSTACLES}
              onClick={() => onChange(addObstacle(spec, kind))}
            >
              {OBSTACLE_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="env-power-lines">
        <h3 id="env-power-lines" className={styles.heading}>
          Rede elétrica
        </h3>
        {(spec.powerLines ?? []).map((line) => (
          <PowerLineEditor
            key={line.id}
            line={line}
            onChange={(changes) => onChange(updatePowerLine(spec, line.id, changes))}
            onRemove={() => onChange(removePowerLine(spec, line.id))}
          />
        ))}
        <div className={styles.actions} role="group" aria-label="Adicionar rede elétrica">
          <Button
            size="sm"
            icon={<Plus size={13} />}
            disabled={(spec.powerLines?.length ?? 0) >= MAX_POWER_LINES}
            onClick={() => onChange(addPowerLine(spec))}
          >
            Rede elétrica
          </Button>
        </div>
        <p className={styles.fineprint}>
          O planejamento mantém a distância mínima da tabela e a avaliação confere a lança, o cabo e
          a carga em qualquer giro.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="env-crane">
        <h3 id="env-crane" className={styles.heading}>
          Posição do guindaste
        </h3>
        <div className={styles.grid3}>
          <NumberField
            label="X (m)"
            unit="m"
            value={spec.crane.x}
            onCommit={(x) => onChange(withCranePlacement(spec, { x }))}
          />
          <NumberField
            label="Z (m)"
            unit="m"
            value={spec.crane.z}
            onCommit={(z) => onChange(withCranePlacement(spec, { z }))}
          />
          <NumberField
            label="Rumo (°)"
            unit="°"
            value={spec.crane.headingDeg}
            onCommit={(headingDeg) => onChange(withCranePlacement(spec, { headingDeg }))}
          />
        </div>
        <p className={styles.fineprint} role="status">
          {groundSlopeDeg === undefined
            ? 'Terreno plano: nenhuma inclinação é enviada à avaliação.'
            : `Inclinação sob o guindaste: ${groundSlopeDeg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}°.`}
        </p>
      </section>
    </div>
  )
}
