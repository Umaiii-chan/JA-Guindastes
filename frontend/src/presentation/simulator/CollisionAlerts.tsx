import { type CollisionState, describeAlert, describeHit } from '../../domain/collision/collisions'
import { Notice } from '../ui'

export interface CollisionAlertsProps {
  readonly collision: CollisionState
}

/**
 * Alertas de colisão da carga (TASK-053; RN-012): o comando bloqueado no último estado seguro (aviso
 * anunciado) e o cabo ou a lança atravessando um obstáculo (só aviso). Sem nada a avisar, não
 * desenha nada.
 */
export function CollisionAlerts({ collision }: CollisionAlertsProps) {
  const { alerts, blocked } = collision
  // Um objeto da biblioteca tem várias caixas de colisão: a mesma frase não se repete.
  const hitMessages = [...new Set(collision.hits.map(describeHit))]
  if (hitMessages.length === 0 && alerts.length === 0) return null
  return (
    <div className="collision-alerts" role="group" aria-label="Colisões">
      {hitMessages.length > 0 && (
        <Notice
          tone="danger"
          role={blocked ? 'alert' : 'status'}
          title={blocked ? 'Colisão: comando bloqueado' : 'Colisão da carga'}
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
