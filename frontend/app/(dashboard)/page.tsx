'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { useOverviewKpis, useOverviewTrend } from '@/lib/api'
import { COLORS, formatCurrency, formatPercent, formatDelta, formatCount } from '@/lib/constants'
import InfoPopover from '@/components/ui/InfoPopover'
import type { OverviewKpiItem } from '@/lib/types'

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

function formatKpiValue(value: number, format: OverviewKpiItem['format']): string {
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

function KpiCard({ kpi }: { kpi: OverviewKpiItem }) {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 h-full min-h-[120px] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      {/* Top row: label + info icon */}
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

      {/* Bottom: value stacked above delta */}
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

// ─── Trend Chart ─────────────────────────────────────────────────────────────

function OverviewTrendChart({ period }: { period: string }) {
  const { data, isLoading } = useOverviewTrend(period)
  if (isLoading || !data) {
    return (
      <div className="h-[240px] md:h-[320px] lg:h-[400px] bg-gray-100 rounded-lg animate-pulse" />
    )
  }

  const months = data.map((d) => d.month)
  const leads = data.map((d) => d.leads)
  const customers = data.map((d) => d.customers)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: '#cbd5e1', type: 'dashed' },
      },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        const header = `<div style="font-weight:600;margin-bottom:4px">${items[0]?.axisValueLabel ?? ''}</div>`
        const rows = items
          .map(
            (p: any) =>
              `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
                <span style="color:#64748b">${p.seriesName}:</span>
                <span style="font-weight:600;font-family:'JetBrains Mono',monospace">${formatCount(p.value)}</span>
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
    grid: { left: '3%', right: '4%', bottom: '10%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { fontSize: 11 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'value',
      scale: false,
      axisLabel: {
        formatter: (v: number) => formatCount(v),
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        name: 'Leads',
        type: 'line',
        data: leads,
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: COLORS.chart[0] },
        itemStyle: { color: COLORS.chart[0] },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: COLORS.chart[0] + '30' },
              { offset: 1, color: COLORS.chart[0] + '00' },
            ],
          },
        },
      },
      {
        name: 'Customers',
        type: 'line',
        data: customers,
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: COLORS.chart[2] },
        itemStyle: { color: COLORS.chart[2] },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: COLORS.chart[2] + '20' },
              { offset: 1, color: COLORS.chart[2] + '00' },
            ],
          },
        },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [period, setPeriod] = useState('12M')
  const { data: kpis, isLoading: kpisLoading } = useOverviewKpis(period)

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

        {/* Trend Chart */}
        <motion.div
          className="bg-white rounded-lg border border-border shadow-sm p-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-base font-semibold text-brand-secondary mb-4">
            Monthly Leads &amp; Customers Trend
          </h2>
          <OverviewTrendChart period={period} />
        </motion.div>
      </div>
    </>
  )
}
