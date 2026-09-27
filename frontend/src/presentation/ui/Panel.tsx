import { type HTMLAttributes, type ReactNode, useId } from 'react'

import { cx } from './cx'
import styles from './Panel.module.css'

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Título do painel; vira o nome acessível da região (`aria-labelledby`). */
  readonly title?: ReactNode
  /** Linha de apoio sob o título. */
  readonly subtitle?: ReactNode
  /** Ícone à esquerda do título. */
  readonly icon?: ReactNode
  /** Ações à direita do cabeçalho (botões, selos). */
  readonly actions?: ReactNode
  /** `glass`: vidro translúcido sobre a cena; `solid`: superfície opaca das páginas. */
  readonly variant?: 'glass' | 'solid'
  readonly as?: 'section' | 'div' | 'aside' | 'article'
  /** Nível do título (padrão 2). */
  readonly headingLevel?: 2 | 3
  /** Sem preenchimento interno no corpo (ex.: tabela de ponta a ponta). */
  readonly flush?: boolean
  /** Rodapé fixo do painel. */
  readonly footer?: ReactNode
}

/** Superfície do design system: painel de vidro escuro (ADR-017 § 2) ou sólido. */
export function Panel({
  title,
  subtitle,
  icon,
  actions,
  variant = 'solid',
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
  const hasHeader = title !== undefined || actions !== undefined

  return (
    <Element
      className={cx(styles.panel, styles[variant], className)}
      aria-labelledby={title !== undefined && !rest['aria-label'] ? titleId : undefined}
      {...rest}
    >
      {hasHeader && (
        <header className={styles.header}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          <div className={styles.headings}>
            {title !== undefined && (
              <Heading id={titleId} className={styles.title}>
                {title}
              </Heading>
            )}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </Element>
  )
}
