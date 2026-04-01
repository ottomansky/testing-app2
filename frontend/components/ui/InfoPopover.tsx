'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface InfoPopoverProps {
  title: string
  formula?: string
  description: string
  sources?: string[]
}

export default function InfoPopover({ title, formula, description, sources }: InfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-5 h-5 rounded-full inline-flex items-center justify-center text-xs
          transition-all duration-150
          ${open
            ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
            : 'bg-gray-100 text-gray-400 border border-transparent hover:bg-brand-primary/5 hover:text-brand-primary'
          }
        `}
        aria-label={`How ${title} is calculated`}
      >
        <Info size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-xl shadow-2xl z-50 text-left overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <h4 className="text-sm font-semibold text-brand-secondary">{title}</h4>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Formula */}
            {formula && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Formula</div>
                <div className="bg-brand-secondary/[0.03] border border-brand-secondary/10 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono text-brand-secondary leading-relaxed break-all">
                    {formula}
                  </code>
                </div>
              </div>
            )}

            {/* Data Sources */}
            {sources && sources.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Data Sources</div>
                <ul className="space-y-1">
                  {sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
                      <span className="font-mono text-[11px]">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-surface/50 border-t border-border/50">
            <span className="text-[10px] text-gray-400">Data refreshed on deploy</span>
          </div>
        </div>
      )}
    </div>
  )
}
