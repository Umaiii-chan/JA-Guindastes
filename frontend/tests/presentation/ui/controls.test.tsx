// @vitest-environment jsdom
// Botões, painel, campos, selos, aviso e slider do design system (TASK-039): comportamento e
// acessibilidade.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Notice,
  Panel,
  Select,
  Slider,
  StatusPill,
} from '../../../src/presentation/ui'

describe('Button', () => {
  it('dispara o clique e é type="button" por padrão (não envia formulário sem querer)', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('carregando: fica desabilitado e marca aria-busy', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Enviar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Enviar' })
    expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('tem nome acessível pelo rótulo e vira alternância com aria-pressed', () => {
    render(<IconButton label="Recolher menu" icon={<svg />} pressed />)
    const button = screen.getByRole('button', { name: 'Recolher menu' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('data-tooltip')).toBe('Recolher menu')
  })
})

describe('Panel', () => {
  it('com título, é uma região nomeada pelo título', () => {
    render(
      <Panel title="Resultado" stamp="FL. 1">
        conteúdo
      </Panel>,
    )
    expect(screen.getByRole('region', { name: 'Resultado' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Resultado' })).toBeTruthy()
  })
})

describe('Field + Input + Select', () => {
  it('liga rótulo, ajuda e erro ao controle', () => {
    render(
      <Field label="Peso" hint="Em quilogramas." error="Obrigatório.">
        <Input unit="kg" />
      </Field>,
    )
    const input = screen.getByLabelText('Peso')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    const descriptions = describedBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
    expect(descriptions).toEqual(['Obrigatório.', 'Em quilogramas.'])
  })

  it('sem erro, o controle não é marcado inválido', () => {
    render(
      <Field label="Nome">
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBeNull()
  })

  it('o Select recebe o rótulo do Field e avisa a escolha', () => {
    const onChange = vi.fn()
    render(
      <Field label="Fabricante">
        <Select value="" onChange={(event) => onChange(event.currentTarget.value)}>
          <option value="">— escolha —</option>
          <option value="A">A</option>
        </Select>
      </Field>,
    )
    fireEvent.change(screen.getByLabelText('Fabricante'), { target: { value: 'A' } })
    expect(onChange).toHaveBeenCalledWith('A')
  })
})

describe('Badge, StatusPill e Notice', () => {
  it('mostram o texto; o StatusPill anuncia mudanças quando live', () => {
    render(
      <>
        <Badge tone="warning">PROVISÓRIO</Badge>
        <StatusPill tone="ok" live>
          Dentro da capacidade
        </StatusPill>
        <Notice tone="warning" title="Dados FICTÍCIOS">
          Não use em operação real.
        </Notice>
      </>,
    )
    expect(screen.getByText('PROVISÓRIO')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Dentro da capacidade')
    expect(screen.getByRole('note').textContent).toContain('Dados FICTÍCIOS')
  })
})

describe('Slider', () => {
  it('rótulo, valor formatado e mudança pelo controle nativo', () => {
    const onChange = vi.fn()
    render(
      <Slider
        label="Inclinação da lança"
        value={30}
        min={0}
        max={80}
        format={(value) => `${value}°`}
        note="Limite FICTÍCIO."
        onChange={onChange}
      />,
    )
    const slider = screen.getByLabelText('Inclinação da lança') as HTMLInputElement
    expect(slider.getAttribute('aria-valuetext')).toBe('30°')
    expect(screen.getByText('30°', { selector: 'output' })).toBeTruthy()
    expect(
      document.getElementById(slider.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Limite FICTÍCIO.')
    expect(slider.parentElement?.style.getPropertyValue('--slider-fill')).toBe('37.5%')
    fireEvent.change(slider, { target: { value: '45' } })
    expect(onChange).toHaveBeenCalledWith(45)
  })

  it('com volta (giro contínuo), a seta na ponta continua além do limite; sem volta, não', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Slider label="Giro" value={180} min={-180} max={180} wraps onChange={onChange} />,
    )
    const slider = screen.getByLabelText('Giro')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenNthCalledWith(1, 181)
    expect(onChange).toHaveBeenNthCalledWith(2, 181)
    // Fora da ponta, quem anda é o controle nativo (nada extra).
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledTimes(2)

    rerender(<Slider label="Giro" value={-180} min={-180} max={180} wraps onChange={onChange} />)
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenNthCalledWith(3, -181)
    expect(onChange).toHaveBeenNthCalledWith(4, -181)

    onChange.mockClear()
    rerender(<Slider label="Giro" value={180} min={-180} max={180} onChange={onChange} />)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sem valor ou limites, fica desabilitado e mostra "—"', () => {
    render(
      <Slider label="Giro" value={undefined} min={undefined} max={undefined} onChange={vi.fn()} />,
    )
    expect(screen.getByLabelText('Giro')).toHaveProperty('disabled', true)
    expect(screen.getByText('—')).toBeTruthy()
  })
})
