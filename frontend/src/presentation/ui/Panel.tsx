import { type HTMLAttributes, type ReactNode, useId } from 'react'

import { cx } from './cx'
import styles from './Panel.module.css'

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Título da folha; vira o nome acessível da região (`aria-labelledby`). */
  readonly title?: ReactNode
  /** Linha de apoio sob o título. */
  readonly subtitle?: ReactNode
  /**
   * Carimbo no canto da folha (ADR-019 § 2): a referência técnica, como "TAB. 1" ou "FL. 03". Texto
   * curto; é decorativo para leitores de tela quando o título já diz o mesmo.
   */
  readonly stamp?: ReactNode
  /** Ações à direita do cabeçalho (botões, selos). */
  readonly actions?: ReactNode
  readonly as?: 'section' | 'div' | 'aside' | 'article'
  /** Nível do título (padrão 2). */
  readonly headingLevel?: 2 | 3
  /** Sem preenchimento interno no corpo (ex.: tabela de ponta a ponta). */
  readonly flush?: boolean
  /** Rodapé da folha, separado por um filete. */
  readonly footer?: ReactNode
}

/**
 * Folha do manual técnico (ADR-019 § 2): papel com borda de 1 px, título em caixa alta pequena sobre
 * um filete e, se houver, o carimbo com a referência no canto. Substitui o painel de vidro.
 */
export function Panel({
  title,
  subtitle,
  stamp,
  actions,
  as: Element = 'section',
  headingLevel = 2,
  flush = false,
  footer,
  className,
  children,
  ...rest
}: PanelProps) {
  const titleId = `${useId()}-title`
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const hasHeader = title !== undefined || actions !== undefined || stamp !== undefined

  return (
    <Element
      className={cx(styles.panel, className)}
      aria-labelledby={title !== undefined && !rest['aria-label'] ? titleId : undefined}
      {...rest}
    >
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.headings}>
            {title !== undefined && (
              <Heading id={titleId} className={styles.title}>
                {title}
              </Heading>
            )}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
          {stamp !== undefined && (
            <span className={styles.stamp} aria-hidden="true">
              {stamp}
            </span>
          )}
        </header>
      )}
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </Element>
  )
}
