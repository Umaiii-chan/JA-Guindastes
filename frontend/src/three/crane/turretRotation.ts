// Giro da torre dentro da faixa do guindaste e caminho entre dois giros (TASK-092), sem Three.js.
// Giro contínuo (sem ψ_min/ψ_max na ficha; ADR-013 C-4): dá a volta e vai pelo menor ângulo. Com
// limites de giro, a faixa é um batente: clamp, e o caminho fica dentro dela.

import { shortestAngleDeltaDeg } from '../../application/recording/playback'
import type { TurretRange } from './types'

/**
 * ψ representado na faixa: com giro contínuo, valores fora dela dão a volta (181° → −179° na faixa
 * −180°..180°) e os de dentro ficam como vieram (−180° continua −180°); com limites, clamp.
 */
export function fitTurretToRange(deg: number, range: TurretRange): number {
  if (deg >= range.min && deg <= range.max) return deg
  if (range.continuous === true) {
    const wrapped = range.min + ((((deg - range.min) % 360) + 360) % 360)
    return Math.min(range.max, Math.max(range.min, wrapped))
  }
  return Math.min(range.max, Math.max(range.min, deg))
}

/**
 * Quanto a torre gira (°, com sinal) para ir de `fromDeg` a `toDeg`, dois valores já na faixa. Giro
 * contínuo: o caminho mais curto, passando por ±180° se for o caso (de 170° a −170° são +20°, não
 * −340°); em meia volta exata (180°), vale o sentido da diferença pedida. Com limites: a diferença
 * direta, que não passa pelo batente.
 */
export function turretTravelDeg(fromDeg: number, toDeg: number, range: TurretRange): number {
  const direct = toDeg - fromDeg
  if (range.continuous !== true || Math.abs(direct) <= 180) return direct
  return shortestAngleDeltaDeg(fromDeg, toDeg)
}
