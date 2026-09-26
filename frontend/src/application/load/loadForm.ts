// Carga da simulação no formulário (RF-011; TASK-034). Repete as validações PROVISÓRIAS da `Load` do
// domínio do backend (TASK-028, `backend/app/domain/entities/load.py`), sem acrescentar regra:
// - descrição obrigatória e não vazia;
// - peso finito e maior que zero (kg, RN-006);
// - comprimento, largura e altura finitos e maiores que zero (m);
// - centro de gravidade opcional; quando informado, três coordenadas finitas (m), a partir do centro
//   da caixa das dimensões, dentro da caixa com as faces incluídas (|coordenada| <= aresta / 2).
// O backend ainda não recebe a carga: só o peso vai para a avaliação (`load_weight_kg`).

export interface Load {
  readonly description: string
  readonly weightKg: number
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  readonly centerOfGravity: {
    readonly alongLengthM: number
    readonly alongWidthM: number
    readonly alongHeightM: number
  } | null
}

/** Campos como digitados (podem estar vazios ou inválidos). */
export interface LoadFormValues {
  readonly description: string
  readonly weightKg: string
  readonly lengthM: string
  readonly widthM: string
  readonly heightM: string
  readonly cgAlongLengthM: string
  readonly cgAlongWidthM: string
  readonly cgAlongHeightM: string
}

export type LoadFormField = keyof LoadFormValues

export const EMPTY_LOAD_FORM: LoadFormValues = {
  description: '',
  weightKg: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  cgAlongLengthM: '',
  cgAlongWidthM: '',
  cgAlongHeightM: '',
}

export type LoadProblems = Readonly<Partial<Record<LoadFormField, string>>>

export type LoadFormResult =
  | { readonly load: Load; readonly problems: LoadProblems }
  | { readonly load: null; readonly problems: LoadProblems }

const DIMENSIONS = [
  { field: 'lengthM', cgField: 'cgAlongLengthM', label: 'do comprimento', name: 'O comprimento' },
  { field: 'widthM', cgField: 'cgAlongWidthM', label: 'da largura', name: 'A largura' },
  { field: 'heightM', cgField: 'cgAlongHeightM', label: 'da altura', name: 'A altura' },
] as const

function parseNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function validateLoadForm(values: LoadFormValues): LoadFormResult {
  const problems: Partial<Record<LoadFormField, string>> = {}

  const description = values.description.trim()
  if (description === '') problems.description = 'Informe a descrição da carga.'

  const weightKg = parseNumber(values.weightKg)
  if (weightKg === null || weightKg <= 0) {
    problems.weightKg = 'O peso deve ser um número maior que zero (kg).'
  }

  const edges: Partial<Record<LoadFormField, number>> = {}
  for (const { field, name } of DIMENSIONS) {
    const value = parseNumber(values[field])
    if (value === null || value <= 0)
      problems[field] = `${name} deve ser um número maior que zero (m).`
    else edges[field] = value
  }

  const cgTexts = DIMENSIONS.map(({ cgField }) => values[cgField].trim())
  const hasCenterOfGravity = cgTexts.some((text) => text !== '')
  const cgValues: Partial<Record<LoadFormField, number>> = {}
  if (hasCenterOfGravity) {
    for (const { field, cgField, label } of DIMENSIONS) {
      const value = parseNumber(values[cgField])
      const edge = edges[field]
      if (value === null) {
        problems[cgField] =
          'Informe as três coordenadas do centro de gravidade (m), ou deixe as três vazias.'
      } else if (edge !== undefined && Math.abs(value) > edge / 2) {
        problems[cgField] =
          `Centro de gravidade fora da carga ao longo ${label}: ` +
          `${value} m a partir do centro, com meia aresta de ${edge / 2} m.`
      } else {
        cgValues[cgField] = value
      }
    }
  }

  const { lengthM, widthM, heightM } = edges
  if (
    Object.keys(problems).length > 0 ||
    weightKg === null ||
    lengthM === undefined ||
    widthM === undefined ||
    heightM === undefined
  ) {
    return { load: null, problems }
  }
  const { cgAlongLengthM, cgAlongWidthM, cgAlongHeightM } = cgValues
  const centerOfGravity =
    cgAlongLengthM !== undefined && cgAlongWidthM !== undefined && cgAlongHeightM !== undefined
      ? { alongLengthM: cgAlongLengthM, alongWidthM: cgAlongWidthM, alongHeightM: cgAlongHeightM }
      : null
  return {
    load: { description, weightKg, lengthM, widthM, heightM, centerOfGravity },
    problems,
  }
}

/**
 * Texto do peso que alimenta a avaliação (o `loadWeightText` do App, TASK-032): o peso da carga
 * quando a carga toda é válida; vazio caso contrário, e a avaliação fica aguardando o peso.
 */
export function loadWeightTextForEvaluation(values: LoadFormValues): string {
  const { load } = validateLoadForm(values)
  return load === null ? '' : String(load.weightKg)
}
