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

function wordmarkClass(size: TeamwiseLogoProps['size']): string {
  if (size === 'small') return 'text-2xl'
  if (size === 'large') return 'text-5xl'
  return 'text-3xl'
}

export function TeamwiseMark({ size = 'default', className = '' }: TeamwiseLogoProps) {
  const pixelSize = logoPixelSize(size)
  return (
    <svg width={pixelSize} height={pixelSize} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="6" width="24" height="22" rx="4" fill="#1D608E" />
      <rect x="4" y="6" width="24" height="6" rx="4" fill="#1D608E" />
      <rect x="6" y="8" width="20" height="2" rx="1" fill="#E27F3F" />
      <path
        d="M10 18L14 22L22 14"
        stroke="#E27F3F"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TeamwiseLogo({
  size = 'default',
  className = '',
  showWordmark = true,
}: TeamwiseLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <TeamwiseMark size={size} />
      {showWordmark && (
        <span className={`font-semibold tracking-tight ${wordmarkClass(size)}`}>
          <span className="text-[#1D608E]">Team</span>
          <span className="text-[#E27F3F]">wise</span>
        </span>
      )}
    </div>
  )
}
