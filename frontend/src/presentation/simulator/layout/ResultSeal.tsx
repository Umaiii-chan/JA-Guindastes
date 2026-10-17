import { StatusPill, type Tone } from '../../ui'

export interface ResultSealProps {
  readonly items: readonly { readonly tone: Tone; readonly label: string }[]
}

/**
 * Selo mínimo do resultado (TASK-104): situação e risco de tombamento. Fica à vista quando
 * "Ocultar painéis" esconde o cartão, para a situação de segurança nunca sumir da tela.
 */
export function ResultSeal({ items }: ResultSealProps) {
  return (
    <div role="status" aria-label="Situação do resultado" style={{ display: 'grid', gap: 4 }}>
      {items.map((item) => (
        <StatusPill key={item.label} tone={item.tone} size="sm">
          {item.label}
        </StatusPill>
      ))}
    </div>
  )
}
