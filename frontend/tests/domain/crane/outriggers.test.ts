import { describe, expect, it } from 'vitest'

import {
  outriggersReady,
  residualSlopeDeg,
  RETRACTED_OUTRIGGERS,
} from '../../../src/domain/crane/outriggers'

describe('patolas (contrato da leva E)', () => {
  it('só ficam prontas estendidas a 100 % e apoiadas', () => {
    expect(outriggersReady(RETRACTED_OUTRIGGERS)).toBe(false)
    expect(outriggersReady({ extensionPercent: 100, jacksSet: false, levelingDeg: 0 })).toBe(false)
    expect(outriggersReady({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })).toBe(true)
  })

  it('o nivelamento só vale com os macacos apoiados', () => {
    expect(residualSlopeDeg(4, { extensionPercent: 100, jacksSet: true, levelingDeg: 3 })).toBe(1)
    expect(residualSlopeDeg(2, { extensionPercent: 100, jacksSet: true, levelingDeg: 3 })).toBe(0)
    expect(residualSlopeDeg(4, { extensionPercent: 100, jacksSet: false, levelingDeg: 3 })).toBe(4)
  })
})
