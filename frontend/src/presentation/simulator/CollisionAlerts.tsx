import { type CollisionState, describeAlert, describeHit } from '../../domain/collision/collisions'
import { Notice } from '../ui'
import styles from './CollisionAlerts.module.css'

export interface CollisionAlertsProps {
  readonly collision: CollisionState
}

/**
 * Alertas de colisão da carga (TASK-053; RN-012): o comando bloqueado no último estado seguro (aviso
 * anunciado) e o cabo ou a lança atravessando um obstáculo (só aviso). O grupo «Colisões» fica sempre
 * na página, vazio quando não há nada a avisar (TASK-078; TASK-082: ele é sobreposto à cena, então
 * aparecer ou sumir um aviso não muda a altura de nada); só os avisos dentro dele vêm e vão.
 */
export function CollisionAlerts({ collision }: CollisionAlertsProps) {
  const { hits, alerts, blocked } = collision
  // Um objeto da biblioteca tem várias caixas de colisão: a mesma frase não se repete.
  const hitMessages = [...new Set(hits.map(describeHit))]
  // Só guindaste contra guindaste (TASK-074), ou o cabo contra a lança do outro (TASK-091): o título
  // não fala da carga.
  const onlyCranes = hits.every((hit) => hit.subject === 'crane' || hit.subject === 'cable')
  const hitsTitle = onlyCranes ? 'Colisão entre os guindastes' : 'Colisão da carga'
  return (
    <div className={styles.box} role="group" aria-label="Colisões">
      {hitMessages.length > 0 && (
        <Notice
          tone="danger"
          role={blocked ? 'alert' : 'status'}
          title={blocked ? 'Colisão: comando bloqueado' : hitsTitle}
          compact
        >
          {blocked && <p>O movimento parou no último estado seguro.</p>}
          <ul>
            {hitMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {alerts.length > 0 && (
        <Notice tone="warning" role="status" title="Atenção: obstáculo no caminho" compact>
          <ul>
            {alerts.map((alert) => (
              <li key={`${alert.segment}-${alert.obstacleId}`}>{describeAlert(alert)}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  )
}
