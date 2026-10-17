import type { TandemLoad } from '../../domain/tandem/tandem'
import type { HookLoad } from './HookLoad'
import type { TandemSceneConfig } from './MultiCrane'

/** O que interessa de um `HookLoad` para saber de onde saem as lingas. */
export type HookRigging = Pick<HookLoad, 'currentAttachOffsetM' | 'currentAccessoriesDropM'>

/**
 * Distância (m) de G até onde as lingas se prendem: o engate do gancho em uso mais a cadeia de
 * acessórios (TASK-090). Sem gancho, `NaN` (o domínio cai no gancho provisório).
 */
export function hookDropM(hook: HookRigging | undefined): number {
  if (!hook) return Number.NaN
  return hook.currentAttachOffsetM + hook.currentAccessoriesDropM
}

/**
 * A carga do tandem com `hookDropsM` lido na hora em cada gancho (TASK-090). A distância muda quando
 * o modelo 3D de um guindaste chega (o gancho é medido de novo) e quando a cadeia de acessórios
 * muda, e a `MultiCrane` monta o `TandemSetup` a cada comando a partir desta carga; com um getter, o
 * engate, o quadro e a colisão usam sempre a medida atual, sem a UI precisar reenviar a carga.
 */
export function withLiveHookDrops(
  config: TandemSceneConfig,
  leader: () => HookRigging | undefined,
  follower: () => HookRigging | undefined,
): TandemSceneConfig {
  const load: TandemLoad = {
    ...config.load,
    get hookDropsM(): readonly [number, number] {
      return [hookDropM(leader()), hookDropM(follower())]
    },
  }
  return { ...config, load }
}
