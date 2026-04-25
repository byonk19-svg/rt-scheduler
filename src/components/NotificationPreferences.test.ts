import { describe, expect, it } from 'vitest'

import { filterUserIdsByNotificationChannel } from '@/lib/notifications'

describe('filterUserIdsByNotificationChannel', () => {
  it('drops users who disabled in-app notifications', async () => {
    const supabase = {
      from(table: string) {
        expect(table).toBe('profiles')
        return {
          select() {
            return {
              in: async () => ({
                data: [
                  { id: 'u1', notification_in_app_enabled: true },
                  { id: 'u2', notification_in_app_enabled: false },
                ],
                error: null,
              }),
            }
          },
        }
      },
    } as never

    const result = await filterUserIdsByNotificationChannel(supabase, ['u1', 'u2'], 'in_app')
    expect(result).toEqual(['u1'])
  })

  it('keeps users opted into email notifications', async () => {
    const supabase = {
      from() {
        return {
          select() {
            return {
              in: async () => ({
                data: [
                  { id: 'u1', notification_email_enabled: true },
                  { id: 'u2', notification_email_enabled: null },
                ],
                error: null,
              }),
            }
          },
        }
      },
    } as never

    const result = await filterUserIdsByNotificationChannel(supabase, ['u1', 'u2'], 'email')
    expect(result).toEqual(['u1', 'u2'])
  })
})
