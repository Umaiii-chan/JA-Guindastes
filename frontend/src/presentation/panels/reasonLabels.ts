// Motivos de "não avaliável" em linguagem de operação (TASK-062). O código do servidor só aparece
// quando não há tradução, para não esconder um motivo novo.

const REASON_LABELS: Readonly<Record<string, string>> = {
  CRANE_GEOMETRY_NOT_FOUND: 'A configuração não tem ficha técnica cadastrada.',
  ACTIVE_LOAD_CHART_NOT_FOUND: 'A configuração não tem tabela de carga ativa.',
  UTILIZATION_UNDEFINED: 'A tabela indica capacidade zero neste ponto.',
  OUTSIDE_GEOMETRIC_DOMAIN: 'A posição está fora do alcance do guindaste.',
  ACCESSORY_NOT_FOUND: 'Um acessório escolhido não está mais no catálogo.',
  POINT_NOT_IN_CHART: 'A posição não está na tabela de carga.',
  BOOM_LENGTH_NOT_IN_CHART: 'A tabela de carga não tem comprimentos de lança.',
  BOOM_LENGTH_ABOVE_CHART_MAX: 'A lança está mais longa que o maior comprimento da tabela.',
  RADIUS_BELOW_CHART_MIN: 'O raio está abaixo do menor raio da tabela.',
  RADIUS_ABOVE_CHART_MAX: 'O raio passa do maior raio da tabela.',
  BOOM_ANGLE_ABOVE_MAX: 'A inclinação da lança passa do máximo da ficha técnica.',
  BOOM_ANGLE_BELOW_MIN: 'A inclinação da lança está abaixo do mínimo da ficha técnica.',
  BOOM_LENGTH_ABOVE_MAX: 'A lança passa do comprimento máximo da ficha técnica.',
  BOOM_LENGTH_BELOW_MIN: 'A lança está abaixo do comprimento mínimo da ficha técnica.',
  CABLE_LENGTH_ABOVE_MAX: 'O cabo passa do comprimento máximo da ficha técnica.',
  CABLE_LENGTH_BELOW_MIN: 'O cabo está abaixo do comprimento mínimo da ficha técnica.',
  TURRET_ROTATION_OUTSIDE_LIMITS: 'O giro está fora dos limites da ficha técnica.',
}

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code
}
