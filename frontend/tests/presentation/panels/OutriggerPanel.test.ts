// Painel das patolas (TASK-054), com o estado alcançado pela animação e o aviso do modelo
// (TASK-093; auditoria de 2026-10-16, F-26 e F-27). Estados FICTÍCIOS (ADR-012).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { type OutriggerState, RETRACTED_OUTRIGGERS } from '../../../src/domain/crane/outriggers'
import { OutriggerPanel } from '../../../src/presentation/panels/OutriggerPanel'

const READY: OutriggerState = { extensionPercent: 100, jacksSet: true, levelingDeg: 3 }
const NO_MODEL_NOTE = 'O modelo 3D atual não traz as patolas'

function visibleText(props: Partial<Parameters<typeof OutriggerPanel>[0]>): string {
  return renderToStaticMarkup(
    createElement(OutriggerPanel, {
      state: RETRACTED_OUTRIGGERS,
      maxLevelingDeg: 3,
      onChange: () => undefined,
      ...props,
    }),
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('OutriggerPanel', () => {
  it('comando pronto, animação ainda a caminho: "não prontas" e "em movimento" (F-27)', () => {
    const text = visibleText({ state: READY, reached: RETRACTED_OUTRIGGERS, moving: true })

    expect(text).toContain('Patolas não prontas')
    expect(text).not.toContain('Patolas prontas')
    expect(text).toContain('Macacos recolhidos')
    expect(text).toContain('em movimento')
  })

  it('"Patolas prontas" quando a animação chega (F-27)', () => {
    const text = visibleText({ state: READY, reached: READY, moving: false })

    expect(text).toContain('Patolas prontas')
    expect(text).toContain('Macacos apoiados · nivelamento 3° de até 3°')
    expect(text).not.toContain('em movimento')
  })

  it('sem o estado da cena, vale o comando', () => {
    expect(visibleText({ state: READY })).toContain('Patolas prontas')
  })

  it('o aviso de modelo sem patolas só aparece quando o modelo não as tem (F-26)', () => {
    expect(visibleText({ modelAvailable: true })).not.toContain(NO_MODEL_NOTE)
    expect(visibleText({ modelAvailable: false })).toContain(NO_MODEL_NOTE)
  })
})
