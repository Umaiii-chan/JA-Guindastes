import { Spinner } from '../ui'
import { Wordmark } from './Wordmark'
import styles from './SessionCheckScreen.module.css'

/** Tela cheia enquanto a sessão é conferida no backend, antes de abrir a casca (TASK-040). */
export function SessionCheckScreen() {
  return (
    <div className={styles.screen}>
      <Wordmark variant="stacked" />
      <p className={styles.text} role="status">
        <Spinner size={16} />
        Conferindo a sessão…
      </p>
    </div>
  )
}
