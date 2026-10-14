import type { Object3D } from 'three'

import type { BodyBox, BodyFrame, CraneBody } from '../../domain/collision/collisions'
import type { CraneRig } from './CraneController'
import { boxInFrameOf } from './rigLandmarks'

// Corpo do guindaste como caixas por nó, para as colisões da carga (TASK-053; ADR-028). Cada caixa é a
// das malhas do nó (sem os nós filhos que a cinemática move) no referencial do próprio nó, então não
// depende da pose. Serve ao guindaste provisório e ao GLB (nós `crane-base`, `crane-turret`,
// `crane-boom` e `crane-boom-extension`). Só desenho: capacidade e segurança são do backend (RN-008).

/** Ignora caixas menores que isto (m): peças soltas, sem volume que valha testar. */
const MIN_HALF_M = 0.01

export function measureCraneBody(rig: CraneRig): CraneBody {
  const nodes: readonly { frame: BodyFrame; node: Object3D; exclude: Object3D[] }[] = [
    { frame: 'base', node: rig.base, exclude: [rig.turret] },
    { frame: 'turret', node: rig.turret, exclude: [rig.boom] },
    { frame: 'boom', node: rig.boom, exclude: [rig.boomExtension] },
    { frame: 'boomExtension', node: rig.boomExtension, exclude: [rig.cable] },
  ]
  const boxes: BodyBox[] = []
  for (const { frame, node, exclude } of nodes) {
    const box = boxInFrameOf(node, node, exclude)
    if (!box) continue
    const half = {
      x: (box.max.x - box.min.x) / 2,
      y: (box.max.y - box.min.y) / 2,
      z: (box.max.z - box.min.z) / 2,
    }
    if (half.x < MIN_HALF_M || half.y < MIN_HALF_M || half.z < MIN_HALF_M) continue
    boxes.push({
      id: node.name || `crane-${frame}`,
      frame,
      center: {
        x: (box.max.x + box.min.x) / 2,
        y: (box.max.y + box.min.y) / 2,
        z: (box.max.z + box.min.z) / 2,
      },
      half,
    })
  }
  const turret = rig.turret.position
  const boom = rig.boom.position
  const extension = rig.boomExtension.position
  return {
    boxes,
    turretOffset: { x: turret.x, y: turret.y, z: turret.z },
    boomPivot: { x: boom.x, y: boom.y, z: boom.z },
    // A extensão desliza em z a partir de `boomRetractedLengthM`; x e y são fixos.
    extensionOffset: { x: extension.x, y: extension.y, z: 0 },
    boomRetractedLengthM: rig.boomRetractedLengthM,
  }
}
