// @vitest-environment jsdom
// Abas, janela modal, painel lateral e notificações (TASK-039): teclado, foco e anúncios.

import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button, Dialog, Drawer, Tabs, ToastProvider, useToast } from '../../../src/presentation/ui'

describe('Tabs', () => {
  const items = [
    { id: 'a', label: 'Fabricante', content: <p>painel A</p> },
    { id: 'b', label: 'Guindaste', content: <p>painel B</p> },
    { id: 'c', label: 'Configuração', content: <p>painel C</p> },
  ]

  it('mostra só o painel da aba escolhida, ligado a ela', () => {
    render(<Tabs items={items} label="Cadastros" />)
    const tab = screen.getByRole('tab', { name: 'Fabricante' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel', { name: 'Fabricante' })
    expect(panel.textContent).toBe('painel A')
    expect(tab.getAttribute('aria-controls')).toBe(panel.id)
    expect(screen.queryByText('painel B')).toBeNull()
  })

  it('setas, Home e End movem o foco e escolhem a aba; só a escolhida entra no Tab', () => {
    render(<Tabs items={items} label="Cadastros" />)
    const first = screen.getByRole('tab', { name: 'Fabricante' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    const second = screen.getByRole('tab', { name: 'Guindaste' })
    expect(document.activeElement).toBe(second)
    expect(second.getAttribute('aria-selected')).toBe('true')
    expect(second.tabIndex).toBe(0)
    expect(first.tabIndex).toBe(-1)
    fireEvent.keyDown(second, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Configuração' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByText('painel C')).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(screen.getByText('painel A')).toBeTruthy()
  })

  it('clique escolhe a aba e avisa onChange', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} label="Cadastros" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }))
    expect(onChange).toHaveBeenCalledWith('c')
    expect(screen.getByText('painel C')).toBeTruthy()
  })
})

function DialogHarness({ kind }: { readonly kind: 'dialog' | 'drawer' }) {
  const [open, setOpen] = useState(false)
  const Overlay = kind === 'dialog' ? Dialog : Drawer
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Overlay open={open} onClose={() => setOpen(false)} title="Sobre" description="Detalhes">
        <input aria-label="Primeiro" />
        <button type="button">Último</button>
      </Overlay>
    </>
  )
}

describe.each(['dialog', 'drawer'] as const)('%s modal', (kind) => {
  it('abre com foco dentro, prende o Tab, fecha com Esc e devolve o foco', () => {
    render(<DialogHarness kind={kind} />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Sobre' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    // O primeiro focável é o botão Fechar do cabeçalho.
    const close = screen.getByRole('button', { name: 'Fechar' })
    expect(document.activeElement).toBe(close)

    const last = screen.getByRole('button', { name: 'Último' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('clique no fundo fecha; clique dentro não', () => {
    render(<DialogHarness kind={kind} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.mouseDown(dialog.parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

function ToastTrigger({ tone }: { readonly tone: 'ok' | 'danger' }) {
  const toast = useToast()
  return (
    <Button onClick={() => toast.show({ title: `Aviso ${tone}`, tone, durationMs: 1000 })}>
      Notificar {tone}
    </Button>
  )
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('anuncia (status ou alert conforme o tom), fecha no botão e some sozinho no tempo', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastTrigger tone="ok" />
        <ToastTrigger tone="danger" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notificar ok' }))
    fireEvent.click(screen.getByRole('button', { name: 'Notificar danger' }))

    const region = screen.getByRole('region', { name: 'Notificações' })
    expect(region.querySelector('[role="status"]')?.textContent).toContain('Aviso ok')
    expect(screen.getByRole('alert').textContent).toContain('Aviso danger')

    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar notificação' })[1])
    expect(screen.queryByRole('alert')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Aviso ok')).toBeNull()
  })

  it('useToast fora do provider falha com mensagem clara', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<ToastTrigger tone="ok" />)).toThrow(/ToastProvider/)
  })
})
