import type { CSSProperties } from 'react'

import { cx } from './cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  readonly width?: number | string
  readonly height?: number | string
  readonly radius?: number | string
  readonly circle?: boolean
  readonly className?: string
}

/**
 * Bloco de carregamento com brilho animado. É decorativo (`aria-hidden`): quem o usa marca a região com
 * `aria-busy` e dá um texto para leitores de tela.
 */
export function Skeleton({
  width = '100%',
  height = 12,
  radius,
  circle,
  className,
}: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height,
    borderRadius: circle ? '50%' : radius,
  }
  return (
    <span
      className={cx(styles.skeleton, className)}
      style={style}
      aria-hidden="true"
      data-skeleton
    />
  )
}

export interface SkeletonTextProps {
  readonly lines?: number
  readonly className?: string
}

/** Várias linhas de texto em carregamento; a última é mais curta. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cx(styles.text, className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 && lines > 1 ? '62%' : '100%'} />
      ))}
    </span>
  )
}
