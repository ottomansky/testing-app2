'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { useMarketingKpis, useMarketingTrend, useMarketingTable } from '@/lib/api'
import {
  COLORS,
  formatCurrency,
  formatPercent,
  formatDelta,
  formatCompact,
  formatCount,
} from '@/lib/constants'
import InfoPopover from '@/components/ui/InfoPopover'
import type { MarketingKpiItem, MarketingTableRow } from '@/lib/types'

// ─── Period filter options ───────────────────────────────────────────────────

const PERIODS = [
  { label: 'L3M', value: 'L3M' },
  { label: 'L6M', value: 'L6M' },
  { label: 'YTD', value: 'YTD' },
  { label: '12M', value: '12M' },
]

// ─── Pill button ─────────────────────────────────────────────────────────────

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-[0.82rem] font-semibold rounded-md
        transition-all duration-150 ease-in-out cursor-pointer
        ${active
          ? 'bg-brand-secondary text-white shadow-sm'
          : 'bg-transparent text-brand-secondary/70 border border-border hover:bg-brand-secondary/5 hover:text-brand-secondary'
        }
      `}
    >
      {children}
    </button>
  )
}

// ─── Filter bar ──────────────────────────────────────────────────────────────

function FilterBar({
  period,
  onPeriodChange,
}: {
  period: string
  onPeriodChange: (p: string) => void
}) {
  return (
    <div
      className="sticky bg-white/80 backdrop-blur-sm border-b border-border/50 z-10"
      style={{ top: 100 }}
    >
      <div className="container-page py-2 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400 mr-1">Period</span>
        {PERIODS.map((p) => (
          <PillButton
            key={p.value}
            active={period === p.value}
            onClick={() => onPeriodChange(p.value)}
          >
            {p.label}
          </PillButton>
        ))}
      </div>
    </div>
  )
}

// ─── KPI formatter helper ────────────────────────────────────────────────────

function formatKpiValue(value: number, format: MarketingKpiItem['format']): string {
  if (format === 'currency') return formatCurrency(value)
  if (format === 'percent') return formatPercent(value)
  return formatCount(value)
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className={`
        inline-flex items-center gap-0.5 text-xs font-semibold mt-1
        ${positive ? 'text-positive' : 'text-negative'}
      `}
    >
      {positive ? '▲' : '▼'} {formatDelta(value)}
    </span>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ kpi }: { kpi: MarketingKpiItem }) {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 h-full min-h-[120px] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-500 font-medium truncate max-w-[20ch]">
          {kpi.label}
        </span>
        <InfoPopover
          title={kpi.label}
          description={kpi.description}
          formula={kpi.formula}
          sources={kpi.sources}
        />
      </div>
      <div className="mt-auto pt-2">
        <div className="text-2xl font-semibold font-mono text-brand-secondary">
          {formatKpiValue(kpi.value, kpi.format)}
        </div>
        <DeltaBadge value={kpi.delta} />
      </div>
    </div>
  )
}

// ─── KPI skeleton ────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 h-full min-h-[120px] flex flex-col justify-between animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="mt-auto pt-2 space-y-2">
        <div className="h-7 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/4" />
      </div>
    </div>
  )
}

// ─── Dual-Axis Revenue vs Ad Costs Chart ─────────────────────────────────────

function MarketingTrendChart({ period }: { period: string }) {
  const { data, isLoading } = useMarketingTrend(period)

  if (isLoading || !data) {
    return (
      <div className="h-[240px] md:h-[320px] lg:h-[400px] bg-gray-100 rounded-lg animate-pulse" />
    )
  }

  const months = data.map((d) => d.month)
  const revenue = data.map((d) => d.revenue)
  const adCosts = data.map((d) => d.ad_costs)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        const header = `<div style="font-weight:600;margin-bottom:4px">${items[0]?.axisValueLabel ?? ''}</div>`
        const rows = items
          .map(
            (p: any) =>
              `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
                <span style="color:#64748b">${p.seriesName}:</span>
                <span style="font-weight:600;font-family:'JetBrains Mono',monospace">${formatCompact(p.value)}</span>
              </div>`,
          )
          .join('')
        return header + rows
      },
    },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 12 },
    },
    grid: { left: '3%', right: '6%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { fontSize: 11, rotate: months.length > 6 ? 25 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: [
      {
        type: 'value',
        scale: false,
        name: 'Revenue',
        nameTextStyle: { fontSize: 10 },
        axisLabel: {
          formatter: (v: number) => formatCompact(v),
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: COLORS.border } },
      },
      {
        type: 'value',
        scale: false,
        name: 'Ad Costs',
        nameTextStyle: { fontSize: 10 },
        axisLabel: {
          formatter: (v: number) => formatCompact(v),
          fontSize: 11,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        yAxisIndex: 0,
        data: revenue,
        itemStyle: {
          color: COLORS.chart[0],
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 40,
      },
      {
        name: 'Ad Costs',
        type: 'line',
        yAxisIndex: 1,
        data: adCosts,
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: COLORS.chart[2] },
        itemStyle: { color: COLORS.chart[2] },
      },
    ],
  }

  return (
    <div className="h-[240px] md:h-[320px] lg:h-[400px]">
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

// ─── Marketing Table ─────────────────────────────────────────────────────────

type SortField = keyof MarketingTableRow
type SortDir = 'asc' | 'desc'

function MarketingTable({ period }: { period: string }) {
  const { data, isLoading } = useMarketingTable(period)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortField]
    const bv = b[sortField]
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const columns: { key: SortField; label: string; fmt: (v: any) => string }[] = [
    { key: 'date', label: 'Date', fmt: (v) => v },
    { key: 'orders', label: 'Orders', fmt: (v) => formatCount(v) },
    { key: 'revenue', label: 'Revenue', fmt: (v) => formatCurrency(v) },
    { key: 'ad_costs', label: 'Ad Costs', fmt: (v) => formatCurrency(v) },
    { key: 'roi', label: 'ROI', fmt: (v) => formatPercent(v) },
    { key: 'cac', label: 'CAC', fmt: (v) => formatCurrency(v) },
    { key: 'aov', label: 'AOV', fmt: (v) => formatCurrency(v) },
  ]

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface/90 border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`
                  px-4 py-3 text-left text-xs font-bold uppercase tracking-wider
                  transition-colors duration-150 cursor-pointer whitespace-nowrap select-none
                  ${sortField === col.key
                    ? 'text-brand-primary'
                    : 'text-brand-secondary/55 hover:text-brand-primary'
                  }
                `}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortField === col.key && sortDir === 'asc' && (
                    <span className="text-brand-primary">▲</span>
                  )}
                  {sortField === col.key && sortDir === 'desc' && (
                    <span className="text-brand-primary">▼</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border transition-all duration-150 hover:bg-brand-primary/[0.02]"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-2.5 font-mono text-xs text-brand-secondary whitespace-nowrap"
                >
                  {col.fmt(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [period, setPeriod] = useState('12M')
  const { data: kpis, isLoading: kpisLoading } = useMarketingKpis(period)

  return (
    <>
      <FilterBar period={period} onPeriodChange={setPeriod} />

      <div className="container-page py-6">
        {/* KPI Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          initial="hidden"
          animate="show"
        >
          {kpisLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                >
                  <KpiSkeleton />
                </motion.div>
              ))
            : (kpis ?? []).map((kpi) => (
                <motion.div
                  key={kpi.key}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                >
                  <KpiCard kpi={kpi} />
                </motion.div>
              ))}
        </motion.div>

        {/* Revenue vs Ad Costs Chart */}
        <motion.div
          className="bg-white rounded-lg border border-border shadow-sm p-4 mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-base font-semibold text-brand-secondary mb-4">
            Revenue vs Ad Costs Over Time
          </h2>
          <MarketingTrendChart period={period} />
        </motion.div>

        {/* Monthly Metrics Table */}
        <motion.div
          className="bg-white rounded-lg border border-border shadow-sm p-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-base font-semibold text-brand-secondary mb-4">
            Monthly Marketing Metrics
          </h2>
          <MarketingTable period={period} />
        </motion.div>
      </div>
    </>
  )
}
