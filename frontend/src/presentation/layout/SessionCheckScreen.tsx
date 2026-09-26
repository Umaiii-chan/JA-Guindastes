import { Spinner } from '../ui'
import { BrandMark } from './BrandMark'
import styles from './SessionCheckScreen.module.css'

/** Tela cheia enquanto a sessão é conferida no backend, antes de abrir a casca (TASK-040). */
export function SessionCheckScreen() {
  return (
    <div className={styles.screen}>
      <BrandMark size={40} />
      <p className={styles.text} role="status">
        <Spinner size={16} />
        Conferindo a sessão…
      </p>
    </div>
  )
}
