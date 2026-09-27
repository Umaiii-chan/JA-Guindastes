import { Plus, Trash2, Wand2 } from 'lucide-react'
import { useId } from 'react'

import type { FormErrors } from '../../application/catalog/catalogForms'
import {
  emptyZoneRow,
  FRONT_110_REAR_250_PRESET,
  type ZoneFormRow,
  zoneFieldPath,
  type ZoneRowField,
  zoneRowsFrom,
  ZONES_FIELD,
} from '../../application/catalog/rotationZones'
import type { RotationZone } from '../../domain/catalog/catalog'
import { Button, Field, IconButton, Input, Notice } from '../ui'
import styles from './catalog.module.css'
import { RotationZoneDiagram } from './RotationZoneDiagram'

export interface RotationZonesEditorProps {
  readonly rows: readonly ZoneFormRow[]
  /** Erros com as chaves `rotationZones` (o todo) e `rotationZones.<i>.<campo>`. */
  readonly errors: FormErrors
  readonly disabled?: boolean
  onChange(rows: readonly ZoneFormRow[]): void
}

const COLUMNS: readonly { field: ZoneRowField; label: string; unit?: string }[] = [
  { field: 'code', label: 'Código' },
  { field: 'name', label: 'Nome' },
  { field: 'startDeg', label: 'Início', unit: '°' },
  { field: 'endDeg', label: 'Fim', unit: '°' },
]

/** Zonas das linhas com os dois ângulos numéricos, para o diagrama acompanhar a digitação. */
function previewZones(rows: readonly ZoneFormRow[]): RotationZone[] {
  return rows.flatMap((row) => {
    const start = Number(row.startDeg.trim().replace(',', '.'))
    const end = Number(row.endDeg.trim().replace(',', '.'))
    if (row.startDeg.trim() === '' || row.endDeg.trim() === '') return []
    if (!Number.isFinite(start) || !Number.isFinite(end)) return []
    return [{ code: row.code.trim(), name: row.name.trim(), startDeg: start, endDeg: end }]
  })
}

/**
 * Editor das zonas de giro da configuração (TASK-046; ADR-018): o atalho "Frontal 110° + lateral e
 * traseira 250°", a edição manual (código, nome e ângulos de ψ, ADR-013) e o diagrama dos setores.
 * Sem linhas, a configuração fica sem zonas (uma tabela para todo o giro).
 */
export function RotationZonesEditor({
  rows,
  errors,
  disabled = false,
  onChange,
}: RotationZonesEditorProps) {
  const legendId = useId()
  const zonesError = errors[ZONES_FIELD]
  const update = (index: number, field: ZoneRowField, value: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, [field]: value } : row)))

  return (
    <fieldset
      className={styles.zonesFieldset}
      disabled={disabled}
      aria-labelledby={legendId}
      aria-describedby={`${legendId}-hint`}
    >
      <legend id={legendId} className={styles.zonesLegend}>
        Zonas de giro (ADR-018)
      </legend>
      <p id={`${legendId}-hint`} className={styles.drawerHint}>
        Quando a tabela do fabricante separa a capacidade por setor de giro, cada zona tem a sua
        tabela ativa. Ângulos de ψ: 0° = frente, 90° = esquerda, no sentido anti-horário visto de
        cima; o setor vai do início ao fim no sentido crescente e pode passar por 0°. Sem zonas, uma
        tabela vale para todo o giro.
      </p>
      <div className={styles.zonesActions}>
        <Button
          size="sm"
          variant="secondary"
          icon={<Wand2 size={14} />}
          onClick={() => onChange(zoneRowsFrom(FRONT_110_REAR_250_PRESET))}
        >
          Frontal 110° + lateral e traseira 250°
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus size={14} />}
          onClick={() => onChange([...rows, emptyZoneRow()])}
        >
          Adicionar zona
        </Button>
        {rows.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={() => onChange([])}
          >
            Sem zonas
          </Button>
        )}
      </div>

      {zonesError && (
        <Notice tone="danger" role="alert" compact title="Zonas de giro inválidas">
          {zonesError}
        </Notice>
      )}

      {rows.length === 0 ? (
        <p className={styles.zonesEmpty}>Sem zonas: uma tabela vale para todo o giro.</p>
      ) : (
        <>
          <ol className={styles.zoneRows} aria-label="Zonas de giro">
            {rows.map((row, index) => (
              <li key={row.key} className={styles.zoneRow}>
                <span className={styles.zoneIndex} aria-hidden="true">
                  {index + 1}
                </span>
                {COLUMNS.map(({ field, label, unit }) => (
                  <Field
                    key={field}
                    label={`${label} (zona ${index + 1})`}
                    error={errors[zoneFieldPath(index, field)]}
                    className={styles[`zoneField_${field}`]}
                  >
                    <Input
                      type={unit ? 'number' : 'text'}
                      inputMode={unit ? 'decimal' : undefined}
                      step={unit ? 'any' : undefined}
                      min={unit ? 0 : undefined}
                      max={unit ? 359.999 : undefined}
                      autoComplete="off"
                      unit={unit}
                      value={row[field]}
                      placeholder={field === 'code' ? 'FRONTAL' : undefined}
                      onChange={(event) =>
                        update(
                          index,
                          field,
                          field === 'code'
                            ? event.currentTarget.value.toUpperCase()
                            : event.currentTarget.value,
                        )
                      }
                    />
                  </Field>
                ))}
                <IconButton
                  size="sm"
                  label={`Remover a zona ${index + 1}`}
                  icon={<Trash2 size={14} />}
                  className={styles.zoneRemove}
                  onClick={() => onChange(rows.filter((_, at) => at !== index))}
                />
              </li>
            ))}
          </ol>
          <RotationZoneDiagram zones={previewZones(rows)} size={112} />
        </>
      )}
    </fieldset>
  )
}
