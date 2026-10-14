// Objetos da biblioteca no cenário (TASK-072; ADR-036): colocar, numerar, excluir e entrar nos
// conflitos da avaliação. Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { addModelAt } from '../../../src/application/environment/editorOps'
import { obstacleConflictIds } from '../../../src/application/environment/obstacleConflicts'
import { MAX_OBSTACLES, removeObstacle } from '../../../src/application/environment/scenarioEditing'
import { NO_COLLISION } from '../../../src/domain/collision/collisions'
import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import { findLibraryObject } from '../../../src/domain/environment/objectLibrary'

describe('addModelAt', () => {
  it('coloca o objeto no ponto, em tamanho real, com id e nome', () => {
    const { spec, id } = addModelAt(EMPTY_SCENARIO, 'barracao-aberto', 3.456, -7.891)
    const shed = findLibraryObject('barracao-aberto')!
    expect(id).toBe('barracao-aberto-1')
    expect(spec.obstacles).toEqual([
      {
        id: 'barracao-aberto-1',
        label: shed.label,
        kind: 'model',
        modelId: 'barracao-aberto',
        centerX: 3.46,
        centerZ: -7.89,
        widthM: shed.baseSize.w,
        depthM: shed.baseSize.d,
        heightM: shed.baseSize.h,
        rotationYDeg: 0,
      },
    ])
  })

  it('numera o segundo do mesmo objeto e não reaproveita id depois de excluir', () => {
    let { spec } = addModelAt(EMPTY_SCENARIO, 'sedan', 0, 0)
    ;({ spec } = addModelAt(spec, 'sedan', 5, 0))
    expect(spec.obstacles.map((o) => [o.id, o.label])).toEqual([
      ['sedan-1', 'Carro (sedã)'],
      ['sedan-2', 'Carro (sedã) 2'],
    ])
    spec = removeObstacle(spec, 'sedan-1')
    const added = addModelAt(spec, 'sedan', 9, 0)
    expect(added.id).toBe('sedan-1')
    expect(new Set(added.spec.obstacles.map((o) => o.id)).size).toBe(2)
  })

  it('id desconhecido ou cenário cheio não mudam nada', () => {
    expect(addModelAt(EMPTY_SCENARIO, 'nao-existe', 0, 0)).toEqual({
      spec: EMPTY_SCENARIO,
      id: null,
    })
    let spec = EMPTY_SCENARIO
    for (let i = 0; i < MAX_OBSTACLES; i += 1) spec = addModelAt(spec, 'moita', i, 0).spec
    expect(spec.obstacles).toHaveLength(MAX_OBSTACLES)
    expect(addModelAt(spec, 'moita', 0, 0).id).toBeNull()
  })
})

describe('conflitos com objetos da biblioteca', () => {
  it('manda o id do objeto em obstacle_conflicts, pelo raio de giro e pela colisão', () => {
    let { spec } = addModelAt(EMPTY_SCENARIO, 'barracao-aberto', 0, 22)
    ;({ spec } = addModelAt(spec, 'pinheiro', 60, 0))
    // O barracão (centro a 22 m, círculo de ~11,4 m) está no raio de giro de 15 m; o pinheiro, não.
    expect(obstacleConflictIds(spec, 15, NO_COLLISION)).toEqual(['barracao-aberto-1'])
    const alert = { segment: 'boom' as const, obstacleId: 'pinheiro-1', label: 'Pinheiro' }
    expect(obstacleConflictIds(spec, 15, { ...NO_COLLISION, alerts: [alert] })).toEqual([
      'barracao-aberto-1',
      'pinheiro-1',
    ])
  })
})
