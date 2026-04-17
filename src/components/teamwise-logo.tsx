type TeamwiseLogoProps = {
  size?: 'small' | 'default' | 'large'
  className?: string
  showWordmark?: boolean
}

function logoPixelSize(size: TeamwiseLogoProps['size']): number {
  if (size === 'small') return 24
  if (size === 'large') return 48
  return 32
}

export function TeamwiseMark({ size = 'default', className = '' }: TeamwiseLogoProps) {
  const pixelSize = logoPixelSize(size)
  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="28" height="28" rx="6" fill="var(--logo-mark-background)" />
      <circle cx="9" cy="10" r="3" fill="var(--logo-mark-primary)" />
      <path d="M4 23 Q4 17 9 17 Q14 17 14 23" fill="var(--logo-mark-primary)" />
      <circle cx="20" cy="10" r="3" fill="var(--logo-mark-secondary)" />
      <path d="M15 23 Q15 17 20 17 Q25 17 25 23" fill="var(--logo-mark-secondary)" />
    </svg>
  )
}

export function TeamwiseLogo({
  size = 'default',
  className = '',
  showWordmark = true,
}: TeamwiseLogoProps) {
  const gap = size === 'small' ? 'gap-2' : 'gap-2.5'
  const textSize = size === 'small' ? 'text-base' : size === 'large' ? 'text-3xl' : 'text-lg'
  return (
    <div className={`flex items-center ${gap} ${className}`.trim()}>
      <TeamwiseMark size={size} />
      {showWordmark && (
        <span
          className={`${textSize} font-sans font-extrabold leading-none tracking-[-0.03em] text-foreground`}
        >
          Team<span className="text-[var(--attention)]">wise</span>
        </span>
      )}
    </div>
  )
}
