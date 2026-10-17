// @vitest-environment jsdom
// Alertas de colisão sobre a cena (TASK-053; TASK-078; TASK-082; TASK-091 F-24): o grupo «Colisões»
// fica sempre na página (aparecer ou sumir um aviso não muda a altura de nada); sem colisão, ele não
// tem nenhum item. Dados FICTÍCIOS.

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { type CollisionState, NO_COLLISION } from '../../../src/domain/collision/collisions'
import { CollisionAlerts } from '../../../src/presentation/simulator/CollisionAlerts'

const OBB = {
  center: { x: 0, y: 0, z: 0 },
  axes: [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ] as const,
  half: { x: 1, y: 1, z: 1 },
}

describe('CollisionAlerts', () => {
  afterEach(cleanup)

  it('sem colisão, o grupo continua na página, vazio', () => {
    render(<CollisionAlerts collision={NO_COLLISION} />)
    const group = screen.getByRole('group', { name: 'Colisões' })
    expect(within(group).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(group).queryByRole('alert')).toBeNull()
    expect(group.childElementCount).toBe(0)
  })

  it('com o comando bloqueado, mostra o aviso e cada colisão como item', () => {
    const blocked: CollisionState = {
      blocked: true,
      alerts: [],
      penetrationM: 0.4,
      hits: [
        { subject: 'accessories', target: { kind: 'terrain' } },
        {
          subject: 'load',
          owner: 'Guindaste 1',
          target: { kind: 'other-crane', part: 'lança do Guindaste 2', obb: OBB },
        },
      ],
    }
    render(<CollisionAlerts collision={blocked} />)
    const group = screen.getByRole('group', { name: 'Colisões' })
    expect(within(group).getByRole('alert').textContent).toContain('comando bloqueado')
    expect(
      within(group)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'A cadeia de acessórios atingiria o terreno.',
      'A carga do Guindaste 1 atingiria o outro guindaste (lança do Guindaste 2).',
    ])
  })

  it('o cabo contra a lança do outro guindaste é colisão entre os guindastes', () => {
    render(
      <CollisionAlerts
        collision={{
          blocked: false,
          alerts: [],
          penetrationM: 0.05,
          hits: [
            {
              subject: 'cable',
              owner: 'Guindaste 2',
              target: { kind: 'other-crane', part: 'lança do Guindaste 1', obb: OBB },
            },
          ],
        }}
      />,
    )
    expect(screen.getByRole('status').textContent).toContain('Colisão entre os guindastes')
  })
})
