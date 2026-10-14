// Prévia e aplicação da proposta de cenário da IA (TASK-076).

import { describe, expect, it } from 'vitest'

import { describeDraft, loadFormFromDraft } from '../../../src/application/ai/scenarioDraft'
import { validateLoadForm } from '../../../src/application/load/loadForm'
import { DRAFT } from '../../fixtures/aiDraft'

describe('loadFormFromDraft', () => {
  it('preenche o passo Carga e o formulário fica válido', () => {
    const values = loadFormFromDraft(DRAFT.load)

    expect(values.weightKg).toBe('8000')
    expect(values.widthM).toBe('0.4')
    const result = validateLoadForm(values)
    expect(result.problems).toEqual({})
    expect(result.load).toMatchObject({ weightKg: 8000, lengthM: 6, widthM: 0.4, heightM: 0.6 })
  })
})

describe('describeDraft', () => {
  it('descreve carga, guindaste, retirada, entrega e obstáculos em pt-BR', () => {
    const lines = describeDraft(DRAFT)

    expect(lines[0]).toBe('Carga: Viga FICTÍCIA, 8.000 kg, 6 × 0,4 × 0,6 m')
    expect(lines).toContain('Retirada da carga em (12 m, 0 m)')
    expect(lines).toContain('Entrega em (-8 m, 0 m), raio de 3 m')
    expect(lines).toContain('1 obstáculo: Carreta')
  })

  it('só cita terreno, vento e solo quando existem', () => {
    const plain = describeDraft(DRAFT).join('|')
    expect(plain).not.toMatch(/Terreno|Vento|solo/)

    const lines = describeDraft({
      ...DRAFT,
      scenario: {
        ...DRAFT.scenario,
        terrain: { slopeXPercent: 3, slopeZPercent: 0, features: [] },
        wind: { speedMs: 8, directionDeg: 0 },
      },
    })
    expect(lines.join('|')).toMatch(/Terreno inclinado \(3 % em X/)
    expect(lines.join('|')).toMatch(/Vento de 8 m\/s/)
  })
})
