// Coleta e entrega sugeridas (TASK-075) enquanto o cenário não as define: a 15 m uma da outra.
// Valores FICTÍCIOS de partida; a pessoa os ajusta no painel "Planejar operação".

import type { CargoPlacement, DeliveryPoint } from '../../domain/environment/environment'

export const DEFAULT_CARGO: CargoPlacement = { x: -7.5, z: 0, rotationYDeg: 0 }
export const DEFAULT_DELIVERY: DeliveryPoint = { x: 7.5, z: 0, rotationYDeg: 0, radiusM: 1.5 }
