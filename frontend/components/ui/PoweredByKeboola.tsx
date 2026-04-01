'use client'

interface PoweredByKeboolaProps {
  platformUrl?: string
  variant?: 'light' | 'dark'
}

export default function PoweredByKeboola({
  platformUrl = '#',
  variant = 'light',
}: PoweredByKeboolaProps) {
  return (
    <a
      href={platformUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-1.5 text-xs
        transition-opacity duration-150
        ${variant === 'light'
          ? 'opacity-40 hover:opacity-70'
          : 'opacity-55 hover:opacity-70'
        }
      `}
      title="Open Keboola platform"
    >
      <img
        src="/keboola-icon.svg"
        alt="Keboola"
        width={16}
        height={16}
        className={variant === 'dark' ? 'invert' : ''}
      />
      <span className="hidden sm:inline">Powered by Keboola</span>
    </a>
  )
}
