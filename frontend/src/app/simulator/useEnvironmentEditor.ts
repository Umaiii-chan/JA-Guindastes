// Estado do editor 3D do ambiente (TASK-066; ADR-032): ferramenta, pincel, solo, seleção e a ligação
// com o cenário (desfazer incluído). O desenho e o mouse ficam em `three/scene/SceneEditor`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_BRUSH, type Brush, withWind } from '../../application/environment/editorOps'
import { removeCargo, removeDelivery } from '../../application/environment/cargoEditing'
import { removeObstacle } from '../../application/environment/scenarioEditing'
import type { SoilKind, WindSpec } from '../../domain/environment/environment'
import { OBJECT_LIBRARY } from '../../domain/environment/objectLibrary'
import type { CraneViewportEditor } from '../../presentation/components/CraneViewport'
import {
  CARGO_SELECTION_ID,
  CRANE_SELECTION_ID,
  DELIVERY_SELECTION_ID,
  type EditorTool,
  type EditorTransformMode,
  extraCraneIdOf,
  extraCraneSelectionId,
} from '../../three/scene/SceneEditor'
import { useScenario } from '../scenario/scenarioContext'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useEnvironmentEditor() {
  const scenario = useScenario()
  const { spec, getSpec, setSpec, checkpoint, undo, canUndo } = scenario
  const [active, setActive] = useState(false)
  const [tool, setTool] = useState<EditorTool>('select')
  const [transformMode, setTransformMode] = useState<EditorTransformMode>('translate')
  const [brush, setBrush] = useState<Brush>(DEFAULT_BRUSH)
  const [soilKind, setSoilKind] = useState<SoilKind>('clay')
  const [lowerTerrain, setLowerTerrain] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Objeto da biblioteca que o clique no chão coloca (TASK-072); lembra a última escolha.
  const [modelId, setModelId] = useState<string | null>(OBJECT_LIBRARY[0]?.id ?? null)

  const selectedObstacle =
    selectedId === null ? undefined : spec.obstacles.find((obstacle) => obstacle.id === selectedId)
  const selectedExtraId = extraCraneIdOf(selectedId)
  const selectedExtraIndex =
    selectedExtraId === null ? -1 : (spec.cranes ?? []).findIndex((c) => c.id === selectedExtraId)
  const selectedLabel =
    selectedId === CRANE_SELECTION_ID
      ? 'Guindaste 1'
      : selectedExtraIndex >= 0
        ? `Guindaste ${selectedExtraIndex + 2}`
        : selectedId === CARGO_SELECTION_ID
          ? 'Carga'
          : selectedId === DELIVERY_SELECTION_ID
            ? 'Ponto de entrega'
            : (selectedObstacle?.label ?? null)
  const canDelete =
    selectedObstacle !== undefined ||
    selectedExtraIndex >= 0 ||
    (selectedId === CARGO_SELECTION_ID && spec.cargo !== undefined) ||
    (selectedId === DELIVERY_SELECTION_ID && spec.delivery !== undefined)

  const deleteSelected = useCallback(() => {
    if (selectedId === null || selectedId === CRANE_SELECTION_ID) return
    const extraId = extraCraneIdOf(selectedId)
    checkpoint()
    const current = getSpec()
    if (extraId !== null) {
      const cranes = (current.cranes ?? []).filter((item) => item.id !== extraId)
      setSpec({ ...current, cranes })
    } else {
      setSpec(
        selectedId === CARGO_SELECTION_ID
          ? removeCargo(current)
          : selectedId === DELIVERY_SELECTION_ID
            ? removeDelivery(current)
            : removeObstacle(current, selectedId),
      )
    }
    setSelectedId(null)
  }, [selectedId, checkpoint, setSpec, getSpec])

  /** Seleciona o guindaste adicional recém criado, para a pessoa já poder arrastá-lo. */
  const selectExtraCrane = useCallback(
    (id: string) => {
      setTool('select')
      setSelectedId(extraCraneSelectionId(id))
    },
    [setTool, setSelectedId],
  )

  const toggle = useCallback(() => {
    setActive((current) => !current)
    setSelectedId(null)
  }, [])

  const done = useCallback(() => {
    setActive(false)
    setSelectedId(null)
  }, [])

  // Um arrasto do controle de vento vale um só ponto de desfazer.
  const lastWindCheckpoint = useRef(0)
  const changeWind = useCallback(
    (wind: WindSpec) => {
      const now = Date.now()
      if (now - lastWindCheckpoint.current > 1000) checkpoint()
      lastWindCheckpoint.current = now
      setSpec(withWind(getSpec(), wind))
    },
    [checkpoint, setSpec, getSpec],
  )

  // Desfazer (Ctrl+Z) e Excluir enquanto o editor está ligado e a pessoa não está digitando.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, undo, deleteSelected])

  // A ferramenta mudou: a seleção só faz sentido em "Selecionar".
  const changeTool = useCallback((next: EditorTool) => {
    setTool(next)
    if (next !== 'select') setSelectedId(null)
  }, [])

  const viewportEditor = useMemo<CraneViewportEditor | null>(
    () =>
      active
        ? {
            config: { tool, transformMode, brush, soilKind, lowerTerrain, selectedId, modelId },
            callbacks: {
              getSpec,
              onChange: setSpec,
              onCheckpoint: checkpoint,
              onSelect: setSelectedId,
              onToolChange: changeTool,
            },
          }
        : null,
    [
      active,
      tool,
      transformMode,
      brush,
      soilKind,
      lowerTerrain,
      selectedId,
      modelId,
      getSpec,
      setSpec,
      checkpoint,
      changeTool,
    ],
  )

  return {
    active,
    toggle,
    done,
    tool,
    changeTool,
    transformMode,
    setTransformMode,
    brush,
    setBrush,
    soilKind,
    setSoilKind,
    lowerTerrain,
    setLowerTerrain,
    modelId,
    setModelId,
    selectedLabel,
    canDelete,
    deleteSelected,
    selectExtraCrane,
    changeWind,
    canUndo,
    undo,
    viewportEditor,
  }
}
