// @vitest-environment jsdom
// Seções recolhíveis da coluna do simulador (TASK-066): abrir e fechar, estado lembrado.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CollapsibleSection } from '../../../src/presentation/simulator/CollapsibleSection'
import { SECTIONS_STORAGE_KEY } from '../../../src/presentation/simulator/useSectionOpen'

describe('CollapsibleSection', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('abre e fecha e lembra a escolha ao voltar', () => {
    const { unmount } = render(
      <CollapsibleSection id="teste" title="Teste">
        conteúdo
      </CollapsibleSection>,
    )
    expect(screen.queryByText('conteúdo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Teste/ }))
    expect(screen.getByText('conteúdo')).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem(SECTIONS_STORAGE_KEY) ?? '{}')).toEqual({
      teste: true,
    })
    unmount()

    render(
      <CollapsibleSection id="teste" title="Teste">
        conteúdo
      </CollapsibleSection>,
    )
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })

  it('funciona sem armazenamento e ignora valores estranhos guardados', () => {
    window.localStorage.setItem(SECTIONS_STORAGE_KEY, '{"teste":"sim"')
    render(
      <CollapsibleSection id="teste" title="Teste" defaultOpen>
        conteúdo
      </CollapsibleSection>,
    )
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })
})
