'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, TrendingUp, LayoutGrid } from 'lucide-react'

const TABS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Marketing', href: '/marketing', icon: TrendingUp },
  { label: 'My Dashboard', href: '/custom', icon: LayoutGrid },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="sticky top-[56px] z-20 glass border-b border-border/60"
      style={{ height: 44 }}
    >
      <div className="container-page h-full flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                transition-colors duration-150 relative
                ${isActive
                  ? 'font-semibold text-brand-primary'
                  : 'font-medium text-brand-secondary/55 hover:text-brand-secondary'
                }
              `}
              style={isActive ? {
                borderBottom: '2px solid #097cf7',
                marginBottom: '-1px',
              } : undefined}
            >
              <Icon size={11} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
