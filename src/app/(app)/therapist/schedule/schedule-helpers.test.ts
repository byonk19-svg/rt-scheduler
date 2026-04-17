import { describe, expect, it } from 'vitest'

import { operationalCodeLabel } from './schedule-helpers'

describe('operationalCodeLabel', () => {
  it('maps on_call to OC', () => expect(operationalCodeLabel('on_call')).toBe('OC'))
  it('maps call_in to CI', () => expect(operationalCodeLabel('call_in')).toBe('CI'))
  it('maps cancelled to CX', () => expect(operationalCodeLabel('cancelled')).toBe('CX'))
  it('maps left_early to LE', () => expect(operationalCodeLabel('left_early')).toBe('LE'))
  it('returns null for unknown values', () => expect(operationalCodeLabel('scheduled')).toBeNull())
  it('returns null for empty string', () => expect(operationalCodeLabel('')).toBeNull())
})
