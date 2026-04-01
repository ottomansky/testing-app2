'use client'

import { usePlatformInfo, useCurrentUser } from '@/lib/api'
import PoweredByKeboola from '@/components/ui/PoweredByKeboola'
import DataStatusBadge from '@/components/ui/DataStatusBadge'

export default function Header() {
  const { data: platform } = usePlatformInfo()
  const { data: user } = useCurrentUser()

  const projectUrl = platform?.connection_url ?? '#'

  return (
    <header
      className="sticky top-0 w-full glass z-30"
      style={{ height: 56 }}
    >
      <div className="container-page h-full flex items-center justify-between">
        {/* Logo + App Title — links to Keboola project */}
        <div className="flex items-center gap-3">
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center shrink-0"
            title="Open Keboola project"
          >
            <img
              src="/keboola-icon.svg"
              alt="Keboola"
              width={28}
              height={28}
            />
          </a>
          <h1 className="text-base font-semibold text-brand-secondary whitespace-nowrap">
            Demo Analytics Dashboard
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <PoweredByKeboola platformUrl={projectUrl} variant="light" />
          <DataStatusBadge />
          {user?.email && (
            <span className="text-sm text-gray-400 hidden md:inline">{user.email}</span>
          )}
        </div>
      </div>
    </header>
  )
}
