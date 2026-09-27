// @vitest-environment jsdom
// Área de arrastar e soltar (TASK-042): estados, arquivo escolhido pelo botão e arquivo solto.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Dropzone, type DropzoneStatus } from '../../../src/presentation/ui/Dropzone'

function renderZone(status: DropzoneStatus = 'idle', onFiles = vi.fn()) {
  const view = render(
    <Dropzone
      label="Arquivo da tabela"
      accept=".csv,.xlsx"
      status={status}
      description="CSV ou XLSX"
      onFiles={onFiles}
    />,
  )
  const zone = view.container.firstElementChild as HTMLElement
  return { ...view, zone, onFiles }
}

const csv = () => new File(['a,b\n1,2\n'], 'tabela_ficticia.csv', { type: 'text/csv' })

describe('Dropzone', () => {
  it('campo de arquivo rotulado, botão de teclado e o estado anunciado', () => {
    renderZone()
    const input = screen.getByLabelText('Arquivo da tabela') as HTMLInputElement
    expect(input.type).toBe('file')
    expect(input.accept).toBe('.csv,.xlsx')
    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Arraste o arquivo para cá')
  })

  it('arquivo escolhido pelo campo chega em onFiles', () => {
    const { onFiles } = renderZone()
    const file = csv()
    fireEvent.change(screen.getByLabelText('Arquivo da tabela'), { target: { files: [file] } })
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('arrastando: muda o visual e o texto; soltar entrega o arquivo', () => {
    const { zone, onFiles } = renderZone()
    const file = csv()

    fireEvent.dragEnter(zone, { dataTransfer: { files: [file] } })
    expect(zone.dataset.status).toBe('dragging')
    expect(screen.getByRole('status').textContent).toContain('Solte para validar')

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(zone.dataset.status).toBe('idle')
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it.each([
    ['validating', 'Validando o arquivo…'],
    ['valid', 'Arquivo válido'],
    ['invalid', 'O arquivo tem problemas'],
  ] as const)('estado %s', (status, title) => {
    const { zone } = renderZone(status)
    expect(zone.dataset.status).toBe(status)
    expect(screen.getByRole('status').textContent).toContain(title)
    expect(screen.getByRole('button', { name: 'Trocar arquivo' })).toBeTruthy()
  })

  it('validando: o botão fica bloqueado', () => {
    renderZone('validating')
    expect(
      (screen.getByRole('button', { name: 'Trocar arquivo' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
