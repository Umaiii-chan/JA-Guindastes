// Visual de manual técnico (ADR-019 § 1; TASK-047, CA-1): nada de degradê, vidro ou brilho no
// frontend. Varre `src/` inteiro, menos `src/three/**` (a cena é conferida pela sua própria parte da
// TASK-047 e pela integração).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../../../src/', import.meta.url))
const SKIPPED_DIRS = [join(SRC, 'three')]
const EXTENSIONS = ['.css', '.ts', '.tsx', '.svg', '.html']

/** Degradês CSS (inclusive os repetidos e cônicos), degradês SVG e o desfoque de fundo (vidro). */
const FORBIDDEN = [
  /linear-gradient/i,
  /radial-gradient/i,
  /conic-gradient/i,
  /backdrop-filter/i,
  /<linearGradient/,
  /<radialGradient/,
]

function sourceFiles(dir: string): string[] {
  if (SKIPPED_DIRS.includes(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return EXTENSIONS.some((extension) => name.endsWith(extension)) ? [path] : []
  })
}

describe('sem degradê, vidro nem brilho em src/ (fora de src/three)', () => {
  const files = sourceFiles(SRC)

  it('encontra os arquivos do frontend e deixa a cena de fora', () => {
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((file) => file.includes(`${sep}three${sep}`))).toBe(false)
    expect(files.some((file) => file.endsWith('tokens.css'))).toBe(true)
  })

  it('nenhum arquivo usa linear-gradient, radial-gradient, backdrop-filter ou degradê SVG', () => {
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return FORBIDDEN.filter((pattern) => pattern.test(text)).map(
        (pattern) => `${relative(SRC, file)}: ${pattern.source}`,
      )
    })
    expect(offenders).toEqual([])
  })

  it('o favicon também não tem degradê', () => {
    const favicon = readFileSync(
      fileURLToPath(new URL('../../../public/favicon.svg', import.meta.url)),
      'utf8',
    )
    expect(FORBIDDEN.filter((pattern) => pattern.test(favicon))).toEqual([])
  })
})
