// Contraste dos pares de token principais (ADR-019 § 1; TASK-047, CA-7), lido do próprio
// tokens.css: texto AA (4,5:1) e elementos gráficos de interface (3:1, WCAG 1.4.11), como o
// contorno de foco e a borda dos campos. Também confere que a paleta é a do ADR-019, que a cena
// (src/three/scene/palette.ts, `PAPER_INK` e `STATUS_COLORS`) repete com os mesmos valores.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL('../../../src/presentation/theme/tokens.css', import.meta.url)),
  'utf8',
)

/** Declarações `--nome: valor;` do primeiro bloco `:root` (o tema; o segundo é o movimento reduzido). */
function readTokens(css: string): Map<string, string> {
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
  const withoutComments = root.replace(/\/\*[\s\S]*?\*\//g, '')
  const tokens = new Map<string, string>()
  for (const match of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim())
  }
  return tokens
}

const TOKENS = readTokens(TOKENS_CSS)

/** Valor final do token, seguindo `var(--outro)` até chegar numa cor `#rrggbb`. */
function hex(name: string, seen: string[] = []): string {
  const value = TOKENS.get(name)
  if (value === undefined) throw new Error(`token ${name} não existe em tokens.css`)
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value)
  if (reference) {
    if (seen.includes(name)) throw new Error(`referência circular em ${name}`)
    return hex(reference[1], [...seen, name])
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} não é uma cor #rrggbb: ${value}`)
  return value.toLowerCase()
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(hex(foreground)), luminance(hex(background))].sort(
    (a, b) => b - a,
  )
  return (light + 0.05) / (dark + 0.05)
}

/** Paleta do ADR-019 § 1 (e da cena). */
const ADR_019 = {
  '--paper': '#f4f1ea',
  '--paper-raised': '#fbfaf6',
  '--ink': '#1f1f1c',
  '--ink-2': '#5c5a53',
  '--rule': '#cfcab9',
  '--color-accent': '#d9480f',
  '--color-status-ok': '#2f6b3a',
  '--color-status-danger': '#b42318',
  '--color-status-warning': '#b7791f',
  '--color-status-neutral': '#77756d',
} as const

describe('paleta do ADR-019', () => {
  it.each(Object.entries(ADR_019))('%s = %s', (token, value) => {
    expect(hex(token)).toBe(value)
  })

  it('o papel da página e o do quadro da cena são o mesmo #f4f1ea', () => {
    expect(hex('--color-bg')).toBe('#f4f1ea')
  })
})

describe('contraste AA do texto (4,5:1)', () => {
  const surfaces = ['--color-bg', '--color-surface-1'] as const
  const texts = [
    '--color-text-1',
    '--color-text-2',
    '--color-text-3',
    '--color-accent-ink',
    '--color-status-ok',
    '--color-status-danger-text',
    '--color-status-warning-text',
    '--color-status-neutral-text',
  ] as const

  for (const surface of surfaces) {
    it.each(texts)(`%s sobre ${surface}`, (text) => {
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it.each([
    // texto de apoio sobre o preenchimento discreto (cabeçalho, hover, primário desabilitado)
    ['--color-text-2', '--color-surface-3'],
    // botão primário (papel sobre o laranja) e o hover dele
    ['--color-text-inverse', '--color-accent-ink'],
    ['--color-text-inverse', '--color-accent-hover'],
    // selos sólidos e etiquetas em tinta
    ['--color-text-inverse', '--color-text-1'],
    ['--color-text-inverse', '--color-text-2'],
    ['--color-text-inverse', '--color-status-ok'],
    ['--color-text-inverse', '--color-status-danger'],
    ['--color-text-inverse', '--color-status-warning-text'],
  ] as const)('%s sobre %s', (text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('contraste de elementos gráficos (3:1)', () => {
  it.each([
    // contorno de foco laranja de 2 px, sobre papel e folha
    ['--color-accent', '--color-bg'],
    ['--color-accent', '--color-surface-1'],
    // borda dos campos e do botão secundário
    ['--color-border-strong', '--color-surface-1'],
    ['--color-border-strong', '--color-bg'],
    // marcas de situação (quadrado da situação, preenchimento da régua)
    ['--color-status-ok', '--color-surface-1'],
    ['--color-status-danger', '--color-surface-1'],
    ['--color-status-warning', '--color-surface-1'],
    ['--color-status-neutral', '--color-surface-1'],
  ] as const)('%s sobre %s', (mark, background) => {
    expect(contrast(mark, background)).toBeGreaterThanOrEqual(3)
  })
})
