import { type CollisionState, describeAlert, describeHit } from '../../domain/collision/collisions'
import { Notice } from '../ui'
import styles from './CollisionAlerts.module.css'

export interface CollisionAlertsProps {
  readonly collision: CollisionState
}

/**
 * Alertas de colisão da carga (TASK-053; RN-012): o comando bloqueado no último estado seguro (aviso
 * anunciado) e o cabo ou a lança atravessando um obstáculo (só aviso). Sem nada a avisar, não
 * desenha nada.
 */
export function CollisionAlerts({ collision }: CollisionAlertsProps) {
  const { hits, alerts, blocked } = collision
  // Um objeto da biblioteca tem várias caixas de colisão: a mesma frase não se repete.
  const hitMessages = [...new Set(hits.map(describeHit))]
  // Sem nada a avisar, o espaço continua reservado (altura fixa): o aviso não empurra a ficha.
  // Só guindaste contra guindaste (TASK-074): o título não fala da carga.
  const onlyCranes = hits.every((hit) => hit.subject === 'crane')
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
