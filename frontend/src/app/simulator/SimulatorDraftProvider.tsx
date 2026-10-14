import { type ReactNode, useMemo, useState } from 'react'

import { EMPTY_LOAD_FORM, type LoadFormValues } from '../../application/load/loadForm'
import type { GuidedStepId } from '../../application/simulator/guidedSteps'
import { SimulatorDraftContext } from './simulatorDraft'

export function SimulatorDraftProvider({ children }: { readonly children: ReactNode }) {
  const [load, setLoad] = useState<LoadFormValues>(EMPTY_LOAD_FORM)
  const [requestedStep, setRequestedStep] = useState<GuidedStepId>('crane')
  const [accessoryIds, setAccessoryIds] = useState<readonly string[]>([])
  const value = useMemo(
    () => ({ load, setLoad, requestedStep, setRequestedStep, accessoryIds, setAccessoryIds }),
    [load, requestedStep, accessoryIds],
  )
  return <SimulatorDraftContext.Provider value={value}>{children}</SimulatorDraftContext.Provider>
}
