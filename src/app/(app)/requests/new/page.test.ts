import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const requestListViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestListView.tsx'),
  'utf8'
)
const requestOpenRequestListSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestOpenRequestList.tsx'),
  'utf8'
)
const requestOpenRequestCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestOpenRequestCard.tsx'),
  'utf8'
)
const requestFormFlowSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestFormFlow.tsx'),
  'utf8'
)
const requestFormStepPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestFormStepPanel.tsx'),
  'utf8'
)
const requestFormDetailsStepSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestFormDetailsStep.tsx'),
  'utf8'
)
const requestFormMessageStepSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestFormMessageStep.tsx'),
  'utf8'
)
const requestFormTeammateStepSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/RequestFormTeammateStep.tsx'),
  'utf8'
)
const requestFormStateSource = readFileSync(
  resolve(process.cwd(), 'src/components/requests/useRequestFormState.ts'),
  'utf8'
)

describe('request creation flow framing', () => {
  it('keeps a separate list view and three-step request form flow', () => {
    expect(requestFormStateSource).toContain("const [view, setView] = useState<'list' | 'form'>(")
    expect(requestFormStateSource).toContain('const [step, setStep] = useState<1 | 2 | 3>(1)')
    expect(requestFormFlowSource).toContain('RequestFormStepPanel')
    expect(requestFormStepPanelSource).toContain('RequestFormDetailsStep')
    expect(requestFormDetailsStepSource).toContain('Step 1: Request details')
    expect(requestFormStepPanelSource).toContain('RequestFormTeammateStep')
    expect(requestFormTeammateStepSource).toContain('Step 2: Choose teammate')
    expect(requestFormStepPanelSource).toContain('RequestFormMessageStep')
    expect(requestFormMessageStepSource).toContain('Step 3: Final message')
  })

  it('keeps the request inbox and form guidance copy intact', () => {
    expect(requestListViewSource).toContain('How requests work')
    expect(requestListViewSource).toContain('RequestOpenRequestList')
    expect(requestOpenRequestListSource).toContain('RequestOpenRequestCard')
    expect(requestOpenRequestListSource).toContain('No requests yet')
    expect(requestOpenRequestCardSource).toContain('Approved by manager')
    expect(requestListViewSource).toContain('Track your swap and pickup requests.')
    expect(requestFormFlowSource).toContain(
      'Complete each step to submit your request for manager review.'
    )
    expect(requestFormTeammateStepSource).toContain('Team members are filtered by shift type')
  })
})
