// Proposta de cenário FICTÍCIA do assistente de IA (TASK-076), para os testes.

import type { AiScenarioDraft } from '../../src/application/ai/ports'
import { EMPTY_SCENARIO } from '../../src/domain/environment/environment'

export const DRAFT: AiScenarioDraft = {
  model: 'gemini-3.7-flash',
  fallbackUsed: false,
  summary: 'Viga içada do barracão até a carreta.',
  assumptions: ['Largura estimada.'],
  load: { description: 'Viga FICTÍCIA', weightKg: 8000, lengthM: 6, widthM: 0.4, heightM: 0.6 },
  scenario: {
    ...EMPTY_SCENARIO,
    obstacles: [
      {
        id: 'o1',
        label: 'Carreta',
        kind: 'box',
        centerX: -8,
        centerZ: 0,
        widthM: 2.5,
        depthM: 12,
        heightM: 1.5,
        rotationYDeg: 0,
      },
    ],
    cargo: { x: 12, z: 0, rotationYDeg: 0 },
    delivery: { x: -8, z: 0, rotationYDeg: 90, radiusM: 3 },
  },
}
