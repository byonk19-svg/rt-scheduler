import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/requests/new/page.tsx'),
  'utf8'
)

describe('requests new page', () => {
  it('defaults to My Requests and only opens compose mode from the query flag', () => {
    expect(source).toContain("const [view, setView] = useState<'list' | 'form'>('list')")
    expect(source).toContain("const composeMode = searchParams.get('new') === '1'")
    expect(source).not.toContain("if (pathname === '/requests/new'")
  })

  it('loads relevant requests for both posters and direct recipients', () => {
    expect(source).toContain('.or(`posted_by.eq.${user.id},claimed_by.eq.${user.id}`)')
    expect(source).toContain("requestVisibility === 'direct'")
    expect(source).toContain(".eq('schedule_cycles.published', true)")
    expect(source).toContain("router.push('/requests/new')")
  })

  it('supports recipient accept or decline on direct requests', () => {
    expect(source).toContain(
      "recipient_response: requestVisibility === 'direct' ? 'pending' : null"
    )
    expect(source).toContain("request.involvement === 'received_direct'")
    expect(source).toContain('Accept')
    expect(source).toContain('Decline')
    expect(source).toContain("handleRecipientDecision(request.id, 'accepted')")
  })

  it('explains the direct-request lifecycle for senders and recipients', () => {
    expect(source).toContain('Waiting for the recipient to respond before manager approval.')
    expect(source).toContain('Recipient accepted. Waiting for manager approval.')
    expect(source).toContain('Recipient declined this direct request.')
    expect(source).toContain('You accepted. Waiting for manager approval.')
    expect(source).toContain('withdrawn before final approval')
  })

  it('surfaces call-in help requests in the request history view', () => {
    expect(source).toContain("request.requestKind === 'call_in'")
    expect(source).toContain('Call-in help')
  })

  it('pauses new request creation when no published shifts are available', () => {
    expect(source).toContain('No published shifts are available for new requests right now.')
    expect(source).toContain('reopened in preliminary')
  })

  it('lets therapists withdraw pending pickup interests from My Requests', () => {
    expect(source).toContain(".from('shift_post_interests')")
    expect(source).toContain("request.involvement === 'interest'")
    expect(source).toContain('Withdraw interest')
    expect(source).toContain(".eq('shift_post_id', sourcePostId)")
    expect(source).toContain(".eq('status', 'pending')")
    expect(source).toContain("status === 'selected'")
  })

  it('labels pickup interest rows as primary claimant versus backup interest', () => {
    expect(source).toContain('getPickupInterestTherapistCopy')
    expect(source).toContain("pickupInterestCopy?.roleLabel ?? 'Interested'")
    expect(source).toContain('pickupInterestCopy.helperText')
  })

  it('lets therapists withdraw their own pending posted requests', () => {
    expect(source).toContain("status: 'withdrawn'")
    expect(source).toContain("request.involvement === 'posted'")
    expect(source).toContain('Withdraw request')
    expect(source).toContain(".in('status', ['pending', 'selected'])")
  })

  it('shows the selected pickup claimant state in My Requests', () => {
    expect(source).toContain("request.status === 'selected'")
    expect(source).toContain("request.status === 'selected' ? 'selected' : 'pending'")
    expect(source).toContain('Withdraw primary claim')
  })
})
