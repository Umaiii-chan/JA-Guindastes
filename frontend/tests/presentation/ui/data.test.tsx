// @vitest-environment jsdom
// Tabela, estado vazio, skeleton, passos e medidor de utilização (TASK-039).

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  EmptyState,
  Gauge,
  Skeleton,
  SkeletonText,
  type StepItem,
  Stepper,
  Table,
} from '../../../src/presentation/ui'

interface Point {
  readonly radius: number
  readonly capacity: number
}

const COLUMNS = [
  { key: 'radius', header: 'Raio (m)', numeric: true, render: (row: Point) => row.radius },
  {
    key: 'capacity',
    header: 'Capacidade (kg)',
    numeric: true,
    render: (row: Point) => row.capacity,
  },
]

describe('Table', () => {
  it('é uma tabela nomeada pela legenda, com cabeçalhos de coluna e as linhas', () => {
    render(
      <Table
        caption="Pontos FICTÍCIOS"
        columns={COLUMNS}
        rows={[
          { radius: 5, capacity: 5000 },
          { radius: 10, capacity: 2500 },
        ]}
        rowKey={(row) => String(row.radius)}
      />,
    )
    const table = screen.getByRole('table', { name: 'Pontos FICTÍCIOS' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Raio (m)', 'Capacidade (kg)'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('2500')).toBeTruthy()
  })

  it('carregando: linhas-fantasma e aria-busy; vazio: mostra o estado vazio', () => {
    const { rerender } = render(
      <Table
        caption="Pontos"
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => String(row.radius)}
        loading
        loadingRows={2}
      />,
    )
    const table = screen.getByRole('table')
    expect(table.getAttribute('aria-busy')).toBe('true')
    expect(table.querySelectorAll('[data-skeleton]')).toHaveLength(4)

    rerender(
      <Table
        caption="Pontos"
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => String(row.radius)}
        empty={<EmptyState icon={<svg />} title="Nenhum ponto" description="Importe uma tabela." />}
      />,
    )
    expect(screen.getByText('Nenhum ponto')).toBeTruthy()
    expect(screen.getByText('Importe uma tabela.')).toBeTruthy()
  })
})

describe('EmptyState e Skeleton', () => {
  it('estado de erro é anunciado; skeleton é decorativo', () => {
    render(
      <>
        <EmptyState icon={<svg />} title="Backend fora do ar" role="alert" />
        <Skeleton />
        <SkeletonText lines={3} />
      </>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Backend fora do ar')
    const skeletons = document.querySelectorAll('[data-skeleton]')
    expect(skeletons).toHaveLength(4)
    skeletons.forEach((element) => {
      expect(element.closest('[aria-hidden="true"]')).not.toBeNull()
    })
  })
})

describe('Stepper', () => {
  const steps: StepItem[] = [
    { id: 'crane', title: 'Guindaste', status: 'complete', summary: 'FAB A · Modelo A1' },
    { id: 'load', title: 'Carga', status: 'current', description: 'Descreva a carga.' },
    { id: 'position', title: 'Posição', status: 'pending', description: 'Mova a lança.' },
  ]

  it('marca o passo aberto com aria-current, mostra o conteúdo e bloqueia o pendente', () => {
    const onSelect = vi.fn()
    render(
      <Stepper steps={steps} activeId="load" onSelect={onSelect} label="Simulação">
        <p>formulário da carga</p>
      </Stepper>,
    )
    const list = screen.getByRole('list', { name: 'Simulação' })
    const buttons = within(list).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[1].getAttribute('aria-current')).toBe('step')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
    expect(
      document.getElementById(buttons[1].getAttribute('aria-controls')!)?.textContent,
    ).toContain('formulário da carga')
    expect(buttons[0].textContent).toContain('concluído')
    expect(buttons[0].textContent).toContain('FAB A · Modelo A1')
    expect(buttons[2]).toHaveProperty('disabled', true)
    expect(buttons[2].textContent).toContain('bloqueado')

    fireEvent.click(buttons[0])
    expect(onSelect).toHaveBeenCalledWith('crane')
    fireEvent.click(buttons[2])
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('Gauge', () => {
  it('é um medidor com o valor, os limites e o texto', () => {
    render(
      <Gauge value={75} tone="ok" label="Utilização" bands={[{ from: 0, to: 100, tone: 'ok' }]} />,
    )
    const meter = screen.getByRole('meter', { name: 'Utilização' })
    expect(meter.getAttribute('aria-valuenow')).toBe('75')
    expect(meter.getAttribute('aria-valuemin')).toBe('0')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
    expect(meter.getAttribute('aria-valuetext')).toBe('75,0 %')
    expect(meter.textContent).toContain('75,0')
  })

  it('acima de 100 %: arco cheio, aria-valuenow no máximo e o valor real no texto', () => {
    render(<Gauge value={132.5} tone="danger" label="Utilização" caption="acima da capacidade" />)
    const meter = screen.getByRole('meter')
    expect(meter.getAttribute('aria-valuenow')).toBe('100')
    expect(meter.getAttribute('aria-valuetext')).toBe('132,5 % — acima da capacidade')
    expect(meter.textContent).toContain('132,5')
  })

  it('sem valor: mostra "—" e não informa aria-valuenow', () => {
    render(<Gauge value={null} tone="neutral" label="Utilização" caption="sem avaliação" />)
    const meter = screen.getByRole('meter')
    expect(meter.getAttribute('aria-valuenow')).toBeNull()
    expect(meter.getAttribute('aria-valuetext')).toBe('sem valor — sem avaliação')
    expect(meter.textContent).toContain('—')
  })
})
