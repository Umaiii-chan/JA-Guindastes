// Rótulos dos obstáculos em conflito enviados ao backend (leva F): o alerta mostra o nome, não o id.
// Dados FICTÍCIOS (ADR-012).

import { describe, expect, it } from 'vitest'

import { obstacleConflictLabels } from '../../../src/application/environment/obstacleConflicts'
import { EMPTY_SCENARIO, type Obstacle } from '../../../src/domain/environment/environment'

function obstacle(id: string, label: string): Obstacle {
  return {
    id,
    label,
    kind: 'box',
    centerX: 0,
    centerZ: 0,
    widthM: 1,
    depthM: 1,
    heightM: 1,
    rotationYDeg: 0,
  }
}

describe('rótulos dos obstáculos em conflito', () => {
  it('troca o id pelo rótulo, sem repetir, e mantém o id sem obstáculo correspondente', () => {
    const spec = {
      ...EMPTY_SCENARIO,
      obstacles: [
        obstacle('ia-obstaculo-4', 'Árvore 1'),
        obstacle('ia-obstaculo-5', 'Carreta'),
        obstacle('ia-obstaculo-6', 'Carreta'),
      ],
    }
    expect(
      obstacleConflictLabels(spec, ['ia-obstaculo-4', 'ia-obstaculo-5', 'ia-obstaculo-6', 'x']),
    ).toEqual(['Árvore 1', 'Carreta', 'x'])
  })
})
