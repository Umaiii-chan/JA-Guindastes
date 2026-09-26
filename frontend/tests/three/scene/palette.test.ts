import { describe, expect, it } from 'vitest'

import {
  EVALUATION_STATUSES,
  normalizeEvaluationStatus,
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

  it('segue o ADR-017: verde, âmbar, vermelho e cinza', () => {
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
