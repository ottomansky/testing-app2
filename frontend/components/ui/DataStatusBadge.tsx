'use client'

import { useHealthCheck } from '@/lib/api'

export default function DataStatusBadge() {
  const { data } = useHealthCheck()
  const count = (data as any)?.tables_loaded ?? 0

  if (!data) return null

  return (
    <span className="text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap hidden sm:inline">
      {count} table{count !== 1 ? 's' : ''} loaded
    </span>
  )
}
