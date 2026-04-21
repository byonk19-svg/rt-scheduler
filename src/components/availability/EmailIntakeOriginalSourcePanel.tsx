'use client'

type AttachmentText = {
  filename: string
  ocrText: string | null
  ocrStatus: 'not_run' | 'completed' | 'failed' | 'skipped'
}

type EmailIntakeOriginalSourcePanelProps = {
  originalEmailText: string | null
  attachmentTexts: AttachmentText[]
}

function hasOriginalEmailContent(
  originalEmailText: string | null,
  attachmentTexts: AttachmentText[]
): boolean {
  return (
    Boolean(originalEmailText?.trim()) ||
    attachmentTexts.some((attachment) => Boolean(attachment.ocrText?.trim()))
  )
}

export function EmailIntakeOriginalSourcePanel({
  originalEmailText,
  attachmentTexts,
}: EmailIntakeOriginalSourcePanelProps) {
  if (!hasOriginalEmailContent(originalEmailText, attachmentTexts)) {
    return null
  }

  return (
    <details className="mt-4 rounded-lg border border-border/70 bg-muted/10">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
        View original email
      </summary>
      <div className="space-y-4 border-t border-border/70 px-3 py-3">
        {originalEmailText?.trim() ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Email body
            </p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/70 px-3 py-2 text-xs text-foreground">
              {originalEmailText}
            </pre>
          </div>
        ) : null}
        {attachmentTexts
          .filter((attachment) => attachment.ocrText?.trim())
          .map((attachment) => (
            <div key={attachment.filename} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {attachment.filename}
              </p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/70 px-3 py-2 text-xs text-foreground">
                {attachment.ocrText}
              </pre>
            </div>
          ))}
      </div>
    </details>
  )
}
