import { Sparkles } from 'lucide-react'

import type { AiModelInfo } from '../../application/ai/ports'
import styles from './ai.module.css'

/** Mostra qual modelo respondeu, e avisa quando foi um reserva (o padrão estava sobrecarregado). */
export function ModelNote({ info }: { readonly info: AiModelInfo }) {
  return (
    <p className={styles.modelNote} data-testid="ai-model-note">
      <Sparkles size={12} aria-hidden="true" />
      <span>
        Respondido por <strong>{info.model}</strong>
        {info.fallbackUsed && ' (modelo reserva: o principal estava sobrecarregado)'}
      </span>
    </p>
  )
}
