import { describe, expect, it } from 'vitest'

import {
  EVALUATION_STATUSES,
  normalizeEvaluationStatus,
  PAPER_INK,
  SCENE_COLORS,
  STATUS_COLORS,
  statusColor,
  statusCssColor,
  toCssHex,
} from '../../../src/three/scene/palette'

describe('palette', () => {
  it('tem uma cor para cada situação, todas diferentes', () => {
    expect([...EVALUATION_STATUSES].sort()).toEqual(['ok', 'over', 'unknown', 'warning'])
    const colors = EVALUATION_STATUSES.map(statusColor)
    expect(new Set(colors).size).toBe(EVALUATION_STATUSES.length)
  })

  it('usa as cores de situação e o papel e tinta do ADR-019, como nos tokens CSS', () => {
    expect(statusCssColor('ok')).toBe('#2f6b3a')
    expect(statusCssColor('over')).toBe('#b42318')
    expect(statusCssColor('warning')).toBe('#b7791f')
    expect(statusCssColor('unknown')).toBe('#77756d')
    expect(toCssHex(PAPER_INK.paper)).toBe('#f4f1ea')
    expect(toCssHex(PAPER_INK.surface)).toBe('#fbfaf6')
    expect(toCssHex(PAPER_INK.ink)).toBe('#1f1f1c')
    expect(toCssHex(PAPER_INK.inkSecondary)).toBe('#5c5a53')
    expect(toCssHex(PAPER_INK.line)).toBe('#cfcab9')
    expect(toCssHex(PAPER_INK.accent)).toBe('#d9480f')
  })

  it('cena em papel e tinta: fundo papel, grade nas linhas, zona atual no acento', () => {
    expect(SCENE_COLORS.background).toBe(PAPER_INK.paper)
    expect(SCENE_COLORS.ground).toBe(PAPER_INK.paper)
    expect(SCENE_COLORS.gridMinor).toBe(PAPER_INK.line)
    expect(SCENE_COLORS.zoneSectorActive).toBe(PAPER_INK.accent)
    expect(SCENE_COLORS.labelText).toBe(PAPER_INK.ink)
    // O acento não se confunde com nenhuma cor de situação.
    expect(Object.values(STATUS_COLORS)).not.toContain(PAPER_INK.accent)
  })

  it('verde, âmbar, vermelho e cinza, distinguíveis pelos canais', () => {
    const channels = (color: number) => ({
      r: (color >> 16) & 0xff,
      g: (color >> 8) & 0xff,
      b: color & 0xff,
    })
    const ok = channels(STATUS_COLORS.ok)
    const warning = channels(STATUS_COLORS.warning)
    const over = channels(STATUS_COLORS.over)
    const unknown = channels(STATUS_COLORS.unknown)

    expect(ok.g).toBeGreaterThan(ok.r)
    expect(ok.g).toBeGreaterThan(ok.b)
    expect(warning.r).toBeGreaterThan(warning.b)
    expect(warning.g).toBeGreaterThan(warning.b)
    expect(over.r).toBeGreaterThan(over.g)
    expect(over.r).toBeGreaterThan(over.b)
    // Cinza: canais próximos entre si.
    expect(
      Math.max(unknown.r, unknown.g, unknown.b) - Math.min(unknown.r, unknown.g, unknown.b),
    ).toBeLessThan(40)
  })

  it('trata qualquer valor desconhecido como "unknown" (cinza)', () => {
    expect(normalizeEvaluationStatus('ok')).toBe('ok')
    expect(normalizeEvaluationStatus(undefined)).toBe('unknown')
    expect(normalizeEvaluationStatus('ALLOWED')).toBe('unknown')
    expect(statusColor('qualquer' as never)).toBe(STATUS_COLORS.unknown)
  })

  it('converte para CSS #rrggbb com zeros à esquerda', () => {
    expect(toCssHex(0x00ff0a)).toBe('#00ff0a')
    expect(statusCssColor('over')).toBe(toCssHex(STATUS_COLORS.over))
    expect(statusCssColor('ok')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
