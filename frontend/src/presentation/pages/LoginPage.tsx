import { ArrowRight, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'

import { BrandMark } from '../layout/BrandMark'
import { ROUTES } from '../layout/navigation'
import { Badge, buttonClassName } from '../ui'
import styles from './LoginPage.module.css'

/**
 * `/login` (ADR-017 § 1), fora da casca: espaço reservado até a TASK-040 trazer o formulário, a sessão
 * e o redirecionamento das rotas guardadas (preservando o destino).
 */
export function LoginPage() {
  return (
    <main className={styles.screen}>
      <div className={styles.grid} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <BrandMark size={40} />
          <div>
            <p className={styles.brandName}>JA Guindastes</p>
            <p className={styles.brandTagline}>Simulador de tabelas de carga</p>
          </div>
        </div>
        <h1 id="login-title" className={styles.title}>
          Entrar
        </h1>
        <p className={styles.text}>
          <LockKeyhole size={15} aria-hidden="true" />O login ainda não está disponível. Por
          enquanto, a aplicação funciona sem autenticação.
        </p>
        <Badge tone="neutral" variant="outline">
          em breve
        </Badge>
        <Link to={ROUTES.home} className={buttonClassName('primary', 'lg', styles.cta)}>
          Continuar sem login
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}
