// Rede elétrica na tela (TASK-107; ADR-051): o HUD da avaliação com a distância e o plano de içamento
// crítico (respostas FICTÍCIAS; o cálculo é do backend, RN-008), o painel do ambiente com a tensão
// escolhida e a edição pura do cenário.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  addPowerLine,
  environmentSummary,
  MAX_POWER_LINES,
  removePowerLine,
  updatePowerLine,
} from '../../../src/application/environment/scenarioEditing'
import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import {
  BackendEvaluationPanel,
  type BackendEvaluationPanelProps,
} from '../../../src/presentation/panels/BackendEvaluationPanel'
import {
  EnvironmentPanel,
  type EnvironmentPanelProps,
} from '../../../src/presentation/panels/EnvironmentPanel'
import { REST_EVALUATED } from '../../fixtures/evaluationResponses'

const BASE: BackendEvaluationPanelProps = {
  result: null,
  error: null,
  pending: false,
  transport: null,
  inputProblem: null,
  loadWeightKg: 1500,
}

function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CLEARANCE = {
  line_id: 'rede-1',
  label: 'Rede FICTÍCIA',
  voltage_kv: 138,
  required_m: 4.572,
  distance_m: 1.02,
  swept_distance_m: 0.98,
  status: 'VIOLATION',
  swept_status: 'VIOLATION',
  nearest_part: 'boom',
}

describe('HUD: distância à rede e içamento crítico', () => {
  const result = mapEvaluationResponse({
    ...REST_EVALUATED,
    alerts: [
      {
        code: 'POWER_LINE_CLEARANCE_VIOLATION',
        severity: 'CRITICAL',
        message: 'Rede FICTÍCIA: lança a 1.02 m da rede, abaixo da distância mínima.',
      },
      {
        code: 'POWER_LINE_CLEARANCE_VIOLATION',
        severity: 'CRITICAL',
        message: 'Outra rede: lança a 2.00 m da rede, abaixo da distância mínima.',
      },
    ],
    power_lines: [CLEARANCE],
    critical_lift: {
      is_critical: true,
      triggers: [{ code: 'TANDEM', message: 'içamento com dois guindastes (tandem)' }],
      plan_items: ['Plano de içamento escrito, assinado pelo responsável técnico'],
    },
  })
  const markup = renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, result }))

  it('lista cada rede com a distância agora, girando e a mínima da tabela', () => {
    const body = text(markup)
    expect(body).toContain('Abaixo da mínima')
    expect(body).toContain('Rede FICTÍCIA (138 kV): lança a 1,02 m, girando 0,98 m; mínima 4,57 m.')
  })

  it('mostra o içamento crítico, os gatilhos e o plano exigido', () => {
    const body = text(markup)
    expect(body).toContain('Içamento crítico')
    expect(body).toContain('içamento com dois guindastes (tandem)')
    expect(body).toContain('Plano de içamento exigido')
    expect(body).toContain('Plano de içamento escrito, assinado pelo responsável técnico')
  })

  it('dois alertas do mesmo código aparecem os dois (chave não repete)', () => {
    const body = text(markup)
    expect(body).toContain('Rede FICTÍCIA: lança a 1.02 m')
    expect(body).toContain('Outra rede: lança a 2.00 m')
  })

  it('içamento comum não mostra o plano', () => {
    const plain = mapEvaluationResponse({
      ...REST_EVALUATED,
      power_lines: [],
      critical_lift: { is_critical: false, triggers: [], plan_items: [] },
    })
    const body = text(
      renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, result: plain })),
    )
    expect(body).not.toContain('Plano de içamento exigido')
  })
})

describe('edição do cenário: rede elétrica', () => {
  it('adiciona um trecho de 13,8 kV a 12 m, com id e nome próprios', () => {
    const spec = addPowerLine(EMPTY_SCENARIO)

    expect(spec.powerLines).toEqual([
      {
        id: 'rede-1',
        label: 'Rede 1',
        x1M: -15,
        z1M: 20,
        x2M: 15,
        z2M: 20,
        heightM: 12,
        voltageKv: 13.8,
      },
    ])
    expect(addPowerLine(spec).powerLines?.map((line) => line.id)).toEqual(['rede-1', 'rede-2'])
  })

  it('troca a tensão e as medidas de um trecho sem mexer nos outros', () => {
    const two = addPowerLine(addPowerLine(EMPTY_SCENARIO))
    const changed = updatePowerLine(two, 'rede-2', { voltageKv: 230, heightM: 20 })

    expect(changed.powerLines?.[0]?.voltageKv).toBe(13.8)
    expect(changed.powerLines?.[1]).toMatchObject({ voltageKv: 230, heightM: 20 })
  })

  it('remove o trecho; sem mais nenhum, a chave sai do cenário', () => {
    const two = addPowerLine(addPowerLine(EMPTY_SCENARIO))
    const one = removePowerLine(two, 'rede-1')
    expect(one.powerLines?.map((line) => line.id)).toEqual(['rede-2'])
    expect(removePowerLine(one, 'rede-2')).not.toHaveProperty('powerLines')
  })

  it('respeita o limite do backend', () => {
    let spec = EMPTY_SCENARIO
    for (let i = 0; i < MAX_POWER_LINES + 3; i += 1) spec = addPowerLine(spec)
    expect(spec.powerLines).toHaveLength(MAX_POWER_LINES)
  })

  it('o resumo do cenário cita a rede e a tensão', () => {
    expect(environmentSummary(EMPTY_SCENARIO)).toBe('Terreno plano, sem obstáculos')
    expect(environmentSummary(addPowerLine(EMPTY_SCENARIO))).toBe('rede 13,8 kV')
  })
})

describe('painel do ambiente: rede elétrica', () => {
  const props = (spec: EnvironmentPanelProps['spec']): EnvironmentPanelProps => ({
    spec,
    onChange: () => undefined,
    groundSlopeDeg: undefined,
    scenarios: [],
    current: null,
    canEditCurrent: false,
    canEdit: () => false,
    dirty: false,
    busy: false,
    error: null,
    info: null,
    onOpen: () => undefined,
    onSave: () => undefined,
    onRemove: () => undefined,
    onReset: () => undefined,
  })

  it('mostra a seção e o botão para adicionar', () => {
    const body = text(renderToStaticMarkup(createElement(EnvironmentPanel, props(EMPTY_SCENARIO))))
    expect(body).toContain('Rede elétrica')
  })

  it('com um trecho: a tensão escolhida, a lista de tensões e a distância mínima da tabela', () => {
    const spec = updatePowerLine(addPowerLine(EMPTY_SCENARIO), 'rede-1', { voltageKv: 138 })
    const markup = renderToStaticMarkup(createElement(EnvironmentPanel, props(spec)))
    const body = text(markup)

    expect(body).toContain('Distância mínima: 4,57 m (OSHA 1926.1408, Tabela A).')
    expect(markup).toContain('<option value="138" selected="">138 kV</option>')
    for (const kv of ['13,8 kV', '230 kV', '500 kV', '1.000 kV']) expect(body).toContain(kv)
  })

  it('uma tensão digitada fora da lista continua selecionável', () => {
    const spec = updatePowerLine(addPowerLine(EMPTY_SCENARIO), 'rede-1', { voltageKv: 88 })
    const markup = renderToStaticMarkup(createElement(EnvironmentPanel, props(spec)))

    expect(markup).toContain('<option value="88" selected="">88 kV</option>')
  })
})
