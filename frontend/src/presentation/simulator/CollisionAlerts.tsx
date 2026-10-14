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
  const { hits, alerts, blocked } = collision
  if (hits.length === 0 && alerts.length === 0) return null
  // Só guindaste contra guindaste (TASK-074): o título não fala da carga.
  const onlyCranes = hits.every((hit) => hit.subject === 'crane')
  // Duas caixas do mesmo par viram uma só mensagem.
  const messages = [...new Set(hits.map((hit) => describeHit(hit)))]
  const hitsTitle = onlyCranes ? 'Colisão entre os guindastes' : 'Colisão da carga'
  return (
    <div className="collision-alerts" role="group" aria-label="Colisões">
      {hits.length > 0 && (
        <Notice
          tone="danger"
          role={blocked ? 'alert' : 'status'}
          title={blocked ? 'Colisão: comando bloqueado' : hitsTitle}
          compact
        >
          {blocked && <p>O movimento parou no último estado seguro.</p>}
          <ul>
            {messages.map((message) => (
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
