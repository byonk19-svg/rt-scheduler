type RpcError = {
  code?: string
  message?: string
}

type RpcClient = {
  rpc: (fn: string, params: Record<string, string>) => unknown
}

export type SetDesignatedLeadInput = {
  cycleId: string
  date: string
  shiftType: 'day' | 'night'
  therapistId: string
}

export type SetDesignatedLeadResult =
  | { ok: true }
  | {
      ok: false
      reason: 'multiple_leads_prevented' | 'lead_not_eligible' | 'invalid_input' | 'failed'
      error?: RpcError
    }

export async function setDesignatedLeadMutation(
  supabase: RpcClient,
  input: SetDesignatedLeadInput
): Promise<SetDesignatedLeadResult> {
  const response = (await supabase.rpc('set_designated_shift_lead', {
    p_cycle_id: input.cycleId,
    p_shift_date: input.date,
    p_shift_type: input.shiftType,
    p_therapist_id: input.therapistId,
  })) as { error: RpcError | null }

  const error = response.error

  if (!error) {
    return { ok: true }
  }

  if (error.code === '23505') {
    return { ok: false, reason: 'multiple_leads_prevented', error }
  }

  if (error.code === '22023') {
    return { ok: false, reason: 'invalid_input', error }
  }

  if (error.code === 'P0001') {
    return { ok: false, reason: 'lead_not_eligible', error }
  }

  return { ok: false, reason: 'failed', error }
}
