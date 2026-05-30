export type ReminderRecipient = {
  therapistId: string
  email: string
  name: string | null
}

type EmailConfig = {
  resendApiKey: string
  fromEmail: string
  resendApiUrl: string
}

type SendInput = {
  recipients: ReminderRecipient[]
  cycleDateRange: string
  availabilityUrl: string
  emailConfig: EmailConfig
}

type SendResult = {
  sent: number
  failed: number
}

function buildReminderEmailPayload(params: {
  recipient: ReminderRecipient
  cycleDateRange: string
  availabilityUrl: string
  fromEmail: string
}) {
  const greeting = params.recipient.name ? `Hi ${params.recipient.name},` : 'Hi there,'
  const subject = `Action needed: submit your availability for Schedule Block ${params.cycleDateRange}`
  const text = [
    greeting,
    '',
    `Please submit your availability for Schedule Block ${params.cycleDateRange}.`,
    '',
    `Submit here: ${params.availabilityUrl}`,
    '',
    '- Teamwise',
  ].join('\n')
  const html = `<p>${greeting}</p><p>Please submit your availability for Schedule Block ${params.cycleDateRange}.</p><p><a href="${params.availabilityUrl}">Submit your availability</a></p><p>- Teamwise</p>`

  return {
    from: params.fromEmail,
    to: params.recipient.email,
    subject,
    text,
    html,
  }
}

export async function sendAvailabilityReminderEmails(input: SendInput): Promise<SendResult> {
  const { recipients, cycleDateRange, availabilityUrl, emailConfig } = input

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const payload = buildReminderEmailPayload({
      recipient,
      cycleDateRange,
      availabilityUrl,
      fromEmail: emailConfig.fromEmail,
    })

    try {
      const response = await fetch(emailConfig.resendApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        sent++
      } else {
        console.error(
          `[availability-reminders] Resend failed for ${recipient.email}: HTTP ${response.status}`
        )
        failed++
      }
    } catch (error) {
      console.error(`[availability-reminders] Resend threw for ${recipient.email}:`, error)
      failed++
    }
  }

  return { sent, failed }
}
