import {
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three'

/** Lado do chão e da grade (m). */
export const GROUND_SIZE_M = 200
/** Lado de cada célula da grade (m). */
export const GRID_CELL_M = 2

/** Adiciona fundo, luzes, chão e grade à cena. O chão fica no plano y = 0. */
export function addEnvironment(scene: Scene): void {
  scene.background = new Color(0xcfd8e3)

  const hemisphere = new HemisphereLight(0xeef3fa, 0x5a5a48, 1.6)
  hemisphere.name = 'environment-hemisphere-light'
  scene.add(hemisphere)

  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.name = 'environment-sun'
  sun.position.set(30, 50, 20)
  scene.add(sun)

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M),
    new MeshStandardMaterial({ color: 0x9aa08f, roughness: 1 }),
  )
  ground.name = 'environment-ground'
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new GridHelper(GROUND_SIZE_M, GROUND_SIZE_M / GRID_CELL_M, 0x55594f, 0x7d8274)
  grid.name = 'environment-grid'
  // Um pouco acima do chão para não disputar profundidade com ele.
  grid.position.y = 0.01
  scene.add(grid)
}
