import { CircleAlert, CircleCheck, FileUp, UploadCloud } from 'lucide-react'
import { type DragEvent, type ReactNode, useId, useRef, useState } from 'react'

import { Button } from './Button'
import { cx } from './cx'
import styles from './Dropzone.module.css'
import { Spinner } from './Spinner'

/** Estado do arquivo escolhido: nenhum, validando, válido ou com erros. */
export type DropzoneStatus = 'idle' | 'validating' | 'valid' | 'invalid'

export interface DropzoneProps {
  /** Rótulo do campo de arquivo (nome acessível). */
  readonly label: string
  /** Tipos aceitos, no formato do `accept` do `<input type="file">` (ex.: `.csv,.xlsx`). */
  readonly accept: string
  readonly status: DropzoneStatus
  /** Título do estado atual (ex.: nome do arquivo, "Validando…"). Padrão conforme o estado. */
  readonly title?: ReactNode
  /** Linha de apoio sob o título (formatos, tamanho, resultado). */
  readonly description?: ReactNode
  readonly disabled?: boolean
  /** Arquivos escolhidos ou soltos (só o primeiro, sem `multiple`). */
  onFiles(files: readonly File[]): void
  readonly className?: string
}

const DEFAULT_TITLE: Record<DropzoneStatus, string> = {
  idle: 'Arraste o arquivo para cá',
  validating: 'Validando o arquivo…',
  valid: 'Arquivo válido',
  invalid: 'O arquivo tem problemas',
}

/**
 * Área de arrastar e soltar com botão "Escolher arquivo" (o teclado usa o botão; o `<input
 * type="file">` fica escondido e rotulado). Mostra os estados: arrastando, validando, válido e com
 * erros. O resultado é anunciado em `role="status"`.
 */
export function Dropzone({
  label,
  accept,
  status,
  title,
  description,
  disabled = false,
  onFiles,
  className,
}: DropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (disabled) return
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length > 0) onFiles(files)
  }

  const shownStatus = dragging ? 'dragging' : status
  const icon =
    shownStatus === 'validating' ? (
      <Spinner size={22} />
    ) : shownStatus === 'valid' ? (
      <CircleCheck size={24} />
    ) : shownStatus === 'invalid' ? (
      <CircleAlert size={24} />
    ) : (
      <UploadCloud size={24} />
    )

  return (
    <div
      className={cx(styles.zone, styles[shownStatus], disabled && styles.disabled, className)}
      data-status={shownStatus}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.text} role="status" aria-live="polite">
        <p className={styles.title}>
          {dragging ? 'Solte para validar' : (title ?? DEFAULT_TITLE[status])}
        </p>
        {description && !dragging && <div className={styles.description}>{description}</div>}
      </div>
      <label htmlFor={inputId} className="visually-hidden">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="visually-hidden"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          if (files.length > 0) onFiles(files)
          event.currentTarget.value = ''
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        icon={<FileUp size={15} />}
        disabled={disabled || status === 'validating'}
        onClick={() => inputRef.current?.click()}
      >
        {status === 'idle' ? 'Escolher arquivo' : 'Trocar arquivo'}
      </Button>
    </div>
  )
}
