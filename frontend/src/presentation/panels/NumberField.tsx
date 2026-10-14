import { useEffect, useRef, useState } from 'react'

import { Field, Input } from '../ui'

/** Número do campo de texto, com vírgula ou ponto decimal; `null` se não for um número finito. */
function parseNumberText(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function formatNumber(value: number): string {
  return String(Math.round(value * 1e6) / 1e6)
}

export interface NumberFieldProps {
  readonly label: string
  readonly value: number
  readonly unit?: string
  /** Só valores acima de zero (raios, larguras, alturas de obstáculo). */
  readonly positive?: boolean
  /** Só valores a partir de zero (altura de feição). */
  readonly nonNegative?: boolean
  /** Faixa fechada aceita (inclinação). */
  readonly min?: number
  readonly max?: number
  onCommit(value: number): void
}

function problemOf(
  value: number | null,
  {
    positive,
    nonNegative,
    min,
    max,
  }: Pick<NumberFieldProps, 'positive' | 'nonNegative' | 'min' | 'max'>,
): string | undefined {
  if (value === null) return 'Informe um número.'
  if (positive && !(value > 0)) return 'Deve ser maior que zero.'
  if (nonNegative && value < 0) return 'Não pode ser negativo.'
  if (min !== undefined && value < min) return `Mínimo ${min}.`
  if (max !== undefined && value > max) return `Máximo ${max}.`
  return undefined
}

/**
 * Campo numérico do editor de cenário: guarda o texto digitado e só envia ao cenário um valor que
 * tem desenho (número finito dentro das faixas). Enquanto o texto é inválido, mostra o motivo e o
 * cenário fica com o último valor bom.
 */
export function NumberField({
  label,
  value,
  unit,
  positive,
  nonNegative,
  min,
  max,
  onCommit,
}: NumberFieldProps) {
  const [text, setText] = useState(() => formatNumber(value))
  const committed = useRef(value)
  // Mudança vinda de fora (abrir outro cenário, trocar a feição): o texto acompanha.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(formatNumber(value))
    }
  }, [value])

  const parsed = parseNumberText(text)
  const problem = problemOf(parsed, { positive, nonNegative, min, max })

  return (
    <Field label={label} error={problem}>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        unit={unit}
        value={text}
        onChange={(event) => {
          const next = event.currentTarget.value
          setText(next)
          const number = parseNumberText(next)
          if (
            number !== null &&
            problemOf(number, { positive, nonNegative, min, max }) === undefined
          ) {
            committed.current = number
            onCommit(number)
          }
        }}
      />
    </Field>
  )
}
