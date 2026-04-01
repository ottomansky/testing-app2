'use client'

import { useState, useRef, useMemo, useCallback, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Pencil, Check, Trash2, LayoutGrid, Download, Image, PlusCircle, BookOpen, Loader2, RefreshCw } from 'lucide-react'
import Draggable from 'react-draggable'
import { Resizable as ResizableBase } from 'react-resizable'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Resizable = ResizableBase as any
import 'react-resizable/css/styles.css'

import { AnimatePresence } from 'framer-motion'
import { useCustomDashboardData, useQueryData } from '@/lib/api'
import { COLORS } from '@/lib/constants'
import { buildOption, TYPES } from '@/lib/chart-utils'
import {
  useDashboards,
  getActiveDashboardId,
  setActiveDashboardId,
  createDashboard,
  renameDashboard,
  deleteDashboard,
  unpinChart,
  updateChartTitle,
  updateChartType,
  updateAllLayouts,
  isDashboardSeeded,
  seedDemoCharts,
} from '@/lib/dashboard-storage'
import type { PinnedChart, Dashboard, AnyDashboardChart } from '@/lib/dashboard-storage'
import type { CustomDashboardData } from '@/lib/types'
import { getLibrary } from '@/lib/chart-config-storage'
import ChartBuilderSidebar from './ChartBuilderSidebar'
import type { SidebarMode } from './ChartBuilderSidebar'

// ── Snap helpers ──────────────────────────────────────────────────────────────

const SNAP = 24 // dot grid size in px
const MAGNET = SNAP // magnetic edge attraction = 1 dot

function snap(v: number) {
  return Math.round(v / SNAP) * SNAP
}

/**
 * Returns true if rect A comes within `gap` px of rect B (or overlaps).
 * gap=0 → only actual overlap; gap=SNAP → enforce 1-dot clearance.
 */
function tooClose(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number, gap = 0): boolean {
  return ax < bx + bw + gap && ax + aw > bx - gap && ay < by + bh + gap && ay + ah > by - gap
}
function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return tooClose(ax, ay, aw, ah, bx, by, bw, bh, 0)
}

type SnapEdges = { left: boolean; right: boolean; top: boolean; bottom: boolean }

/**
 * Snap dragged chart edges to nearby chart edges (magnetic snap, 1 dot = 24px).
 * Returns snapped position and which edges are active (for visual guides).
 */
function magnetSnap(
  x: number, y: number, w: number, h: number,
  others: PinnedChart[],
): { x: number; y: number; edges: SnapEdges } {
  let sx = x, sy = y
  const edges: SnapEdges = { left: false, right: false, top: false, bottom: false }

  for (const o of others) {
    const oL = o.x, oR = o.x + o.w, oT = o.y, oB = o.y + o.h
    // X axis — adjacent only, always 1 dot gap between charts
    if (!edges.left && !edges.right) {
      if (Math.abs(x - (oR + SNAP)) <= MAGNET)         { sx = oR + SNAP;         edges.left = true }
      else if (Math.abs((x + w) - (oL - SNAP)) <= MAGNET) { sx = oL - SNAP - w; edges.right = true }
    }
    // Y axis — same
    if (!edges.top && !edges.bottom) {
      if (Math.abs(y - (oB + SNAP)) <= MAGNET)         { sy = oB + SNAP;         edges.top = true }
      else if (Math.abs((y + h) - (oT - SNAP)) <= MAGNET) { sy = oT - SNAP - h; edges.bottom = true }
    }
  }

  return { x: Math.max(0, sx), y: Math.max(0, sy), edges }
}

// ── Chart Card ───────────────────────────────────────────────────────────────

interface ChartItemProps {
  chart: PinnedChart
  others: PinnedChart[]
  containerWidth: number
  onDragStop: (id: string, x: number, y: number) => void
  onResizeStop: (id: string, x: number, y: number, w: number, h: number) => void
}

function ChartItem({ chart, others, containerWidth, onDragStop, onResizeStop }: ChartItemProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(chart.title)
  const [fullscreen, setFullscreen] = useState(false)
  const [pos, setPos] = useState({ x: chart.x, y: chart.y })
  const [size, setSize] = useState({ w: chart.w, h: chart.h })
  const [snapEdges, setSnapEdges] = useState<SnapEdges>({ left: false, right: false, top: false, bottom: false })
  const [isDragging, setIsDragging] = useState(false)
  const lastValidPos = useRef({ x: chart.x, y: chart.y })
  // Track size at resize-start so we can compute deltas for left/top handles
  const resizeStartRef = useRef({ x: chart.x, y: chart.y, w: chart.w, h: chart.h })
  const chartRef = useRef<any>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  // Sync from storage (e.g. after rename or tab switch)
  useEffect(() => { setPos({ x: chart.x, y: chart.y }); lastValidPos.current = { x: chart.x, y: chart.y } }, [chart.x, chart.y])
  useEffect(() => { setSize({ w: chart.w, h: chart.h }) }, [chart.w, chart.h])

  // Trigger echarts resize when size changes
  useEffect(() => {
    chartRef.current?.getEchartsInstance?.()?.resize?.()
  }, [size])

  const option = useMemo(() => buildOption(chart.headers, chart.rows, chart.chartType, false), [chart.headers, chart.rows, chart.chartType])
  const fsOption = useMemo(() => buildOption(chart.headers, chart.rows, chart.chartType, true), [chart.headers, chart.rows, chart.chartType])

  const handleTitleSave = () => { if (titleDraft.trim()) updateChartTitle(chart.id, titleDraft.trim()); setEditing(false) }

  // Snap-edge border overlay: 2px colored lines on snapping sides
  const snapBorder = {
    borderTop: snapEdges.top ? '2px solid #097cf7' : undefined,
    borderBottom: snapEdges.bottom ? '2px solid #097cf7' : undefined,
    borderLeft: snapEdges.left ? '2px solid #097cf7' : undefined,
    borderRight: snapEdges.right ? '2px solid #097cf7' : undefined,
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".chart-drag-handle"
      grid={[SNAP, SNAP]}
      position={pos}
      bounds={{ left: 0, top: 0, right: containerWidth > 0 ? containerWidth - size.w : undefined }}
      onStart={() => setIsDragging(true)}
      onDrag={(_e, d) => {
        const proposed = { x: Math.max(0, d.x), y: Math.max(0, d.y) }
        const blocked = others.some((o) => overlaps(proposed.x, proposed.y, size.w, size.h, o.x, o.y, o.w, o.h))
        if (!blocked) {
          lastValidPos.current = proposed
          setPos(proposed)
        } else {
          setPos(lastValidPos.current)
        }
        const { edges } = magnetSnap(proposed.x, proposed.y, size.w, size.h, others)
        setSnapEdges(edges)
      }}
      onStop={() => {
        setIsDragging(false)
        const base = lastValidPos.current
        const { x, y, edges } = magnetSnap(snap(base.x), snap(base.y), size.w, size.h, others)
        const snappedBlocked = others.some((o) => overlaps(x, y, size.w, size.h, o.x, o.y, o.w, o.h))
        const fx = snappedBlocked ? snap(base.x) : x
        const fy = snappedBlocked ? snap(base.y) : y
        setPos({ x: fx, y: fy })
        setSnapEdges(snappedBlocked ? { left: false, right: false, top: false, bottom: false } : edges)
        setTimeout(() => setSnapEdges({ left: false, right: false, top: false, bottom: false }), 400)
        onDragStop(chart.id, fx, fy)
      }}
    >
      <div ref={nodeRef} style={{ position: 'absolute', width: size.w, height: size.h }}>
        <Resizable
          width={size.w}
          height={size.h}
          minConstraints={[144, 96]}
          grid={[SNAP, SNAP]}
          onResizeStart={() => {
            resizeStartRef.current = { x: pos.x, y: pos.y, w: size.w, h: size.h }
          }}
          onResize={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = s.width
            let newH = s.height
            let newX = isLeft
              ? Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW)
              : pos.x
            let newY = isTop
              ? Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH)
              : pos.y
            // Clamp right edge to container
            if (containerWidth > 0 && newX + newW > containerWidth) newW = containerWidth - newX
            // Collision clamp with SNAP gap — revert whichever axis caused the violation
            if (others.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = pos.x; newW = size.w }
              else if (isTop) { newY = pos.y; newH = size.h }
              else { newW = size.w; newH = size.h }
            }
            setPos({ x: newX, y: newY })
            setSize({ w: newW, h: newH })
          }}
          onResizeStop={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = snap(s.width)
            let newH = snap(s.height)
            let newX = isLeft
              ? snap(Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW))
              : snap(pos.x)
            let newY = isTop
              ? snap(Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH))
              : snap(pos.y)
            if (containerWidth > 0 && newX + newW > containerWidth) newW = snap(containerWidth - newX)
            if (others.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = snap(pos.x); newW = snap(size.w) }
              else if (isTop) { newY = snap(pos.y); newH = snap(size.h) }
              else { newW = snap(size.w); newH = snap(size.h) }
            }
            setPos({ x: newX, y: newY })
            setSize({ w: newW, h: newH })
            onResizeStop(chart.id, newX, newY, newW, newH)
          }}
          resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'n', 'e', 'w']}
        >
          <div style={{ width: size.w, height: size.h, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', transition: 'box-shadow 150ms', ...snapBorder }}>
            {/* Drag handle header */}
            <div className="chart-drag-handle" style={{ cursor: 'grab', background: 'rgba(248,250,252,0.9)', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 32, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                {editing ? (
                  <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitleDraft(chart.title); setEditing(false) } }}
                    onBlur={handleTitleSave}
                    style={{ fontSize: 11, fontWeight: 600, color: '#002151', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 0 }}
                  />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#002151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chart.title}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {editing ? (
                  <button onClick={handleTitleSave} style={{ color: '#16a34a', cursor: 'pointer', padding: 1 }}><Check size={12} /></button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Rename"><Pencil size={12} /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setFullscreen(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Fullscreen"><Maximize2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); unpinChart(chart.id) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Remove"><X size={12} /></button>
              </div>
            </div>

            {/* Chart type pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', flexShrink: 0 }}>
              {TYPES.map((t) => (
                <button key={t} onClick={() => updateChartType(chart.id, t)}
                  style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', transition: 'all 150ms', background: chart.chartType === t ? COLORS.brandPrimary : 'transparent', color: chart.chartType === t ? '#fff' : '#64748b', border: `1px solid ${chart.chartType === t ? COLORS.brandPrimary : '#e2e8f0'}` }}>
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {option ? (
                <ReactECharts ref={chartRef} option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>No data</div>
              )}
            </div>
          </div>
        </Resizable>

        {/* Fullscreen */}
        {fullscreen && typeof document !== 'undefined' && createPortal(
          <motion.div className="fixed inset-0" style={{ zIndex: 998, background: 'rgba(0,10,26,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ width: '100%', maxWidth: 1100, height: '80vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#002151' }}>{chart.title}</span>
                <button onClick={() => setFullscreen(false)} style={{ color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
                {fsOption && <ReactECharts option={fsOption} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />}
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
      </div>
    </Draggable>
  )
}

// ── Dynamic Chart (live query) ───────────────────────────────────────────────

interface DynamicChartContentProps {
  configId: string
  chartId: string
  others: AnyDashboardChart[]
  containerWidth: number
  onDragStop: (id: string, x: number, y: number) => void
  onResizeStop: (id: string, x: number, y: number, w: number, h: number) => void
  x: number; y: number; w: number; h: number
  pinnedAt: string
  isSelected?: boolean
  onSelect?: (chartId: string) => void
}

function DynamicChartContent({ configId, chartId, others, containerWidth, onDragStop, onResizeStop, x, y, w, h, isSelected, onSelect }: DynamicChartContentProps) {
  const config = getLibrary().configs.find((c) => c.id === configId) ?? null
  const { data, isFetching, refetch } = useQueryData(config)
  const [fullscreen, setFullscreen] = useState(false)
  const [pos, setPos] = useState({ x, y })
  const [size, setSize] = useState({ w, h })
  const [snapEdges, setSnapEdges] = useState<SnapEdges>({ left: false, right: false, top: false, bottom: false })
  const [isDragging, setIsDragging] = useState(false)
  const lastValidPos = useRef({ x, y })
  const resizeStartRef = useRef({ x, y, w, h })
  const chartRef = useRef<any>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPos({ x, y }); lastValidPos.current = { x, y } }, [x, y])
  useEffect(() => { setSize({ w, h }) }, [w, h])
  useEffect(() => { chartRef.current?.getEchartsInstance?.()?.resize?.() }, [size])

  // Cast others to PinnedChart-compatible for collision (use x,y,w,h fields which exist on both)
  const othersRect = others.map((o) => ({ ...o, title: '', headers: [], rows: [], chartType: 'bar', pinnedAt: '', sourceQuestion: '' } as PinnedChart))

  const option = useMemo(() => data ? buildOption(data.headers, data.rows, config?.chartType ?? 'bar', false) : null, [data, config?.chartType])
  const fsOption = useMemo(() => data ? buildOption(data.headers, data.rows, config?.chartType ?? 'bar', true) : null, [data, config?.chartType])

  const snapBorder = {
    borderTop: snapEdges.top ? '2px solid #097cf7' : undefined,
    borderBottom: snapEdges.bottom ? '2px solid #097cf7' : undefined,
    borderLeft: snapEdges.left ? '2px solid #097cf7' : undefined,
    borderRight: snapEdges.right ? '2px solid #097cf7' : undefined,
  }

  if (!config) return null

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".chart-drag-handle"
      grid={[SNAP, SNAP]}
      position={pos}
      bounds={{ left: 0, top: 0, right: containerWidth > 0 ? containerWidth - size.w : undefined }}
      onStart={() => setIsDragging(true)}
      onDrag={(_e, d) => {
        const proposed = { x: Math.max(0, d.x), y: Math.max(0, d.y) }
        const blocked = othersRect.some((o) => overlaps(proposed.x, proposed.y, size.w, size.h, o.x, o.y, o.w, o.h))
        if (!blocked) { lastValidPos.current = proposed; setPos(proposed) }
        else setPos(lastValidPos.current)
        const { edges } = magnetSnap(proposed.x, proposed.y, size.w, size.h, othersRect)
        setSnapEdges(edges)
      }}
      onStop={() => {
        setIsDragging(false)
        const base = lastValidPos.current
        const { x: fx, y: fy, edges } = magnetSnap(snap(base.x), snap(base.y), size.w, size.h, othersRect)
        const snappedBlocked = othersRect.some((o) => overlaps(fx, fy, size.w, size.h, o.x, o.y, o.w, o.h))
        const finalX = snappedBlocked ? snap(base.x) : fx
        const finalY = snappedBlocked ? snap(base.y) : fy
        setPos({ x: finalX, y: finalY })
        setSnapEdges(snappedBlocked ? { left: false, right: false, top: false, bottom: false } : edges)
        setTimeout(() => setSnapEdges({ left: false, right: false, top: false, bottom: false }), 400)
        onDragStop(chartId, finalX, finalY)
      }}
    >
      <div ref={nodeRef} style={{ position: 'absolute', width: size.w, height: size.h }}>
        <Resizable
          width={size.w} height={size.h}
          minConstraints={[144, 96]} grid={[SNAP, SNAP]}
          onResizeStart={() => { resizeStartRef.current = { x: pos.x, y: pos.y, w: size.w, h: size.h } }}
          onResize={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = s.width, newH = s.height
            let newX = isLeft ? Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW) : pos.x
            let newY = isTop ? Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH) : pos.y
            if (containerWidth > 0 && newX + newW > containerWidth) newW = containerWidth - newX
            if (othersRect.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = pos.x; newW = size.w }
              else if (isTop) { newY = pos.y; newH = size.h }
              else { newW = size.w; newH = size.h }
            }
            setPos({ x: newX, y: newY }); setSize({ w: newW, h: newH })
          }}
          onResizeStop={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = snap(s.width), newH = snap(s.height)
            let newX = isLeft ? snap(Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW)) : snap(pos.x)
            let newY = isTop ? snap(Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH)) : snap(pos.y)
            if (containerWidth > 0 && newX + newW > containerWidth) newW = snap(containerWidth - newX)
            if (othersRect.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = snap(pos.x); newW = snap(size.w) }
              else if (isTop) { newY = snap(pos.y); newH = snap(size.h) }
              else { newW = snap(size.w); newH = snap(size.h) }
            }
            setPos({ x: newX, y: newY }); setSize({ w: newW, h: newH })
            onResizeStop(chartId, newX, newY, newW, newH)
          }}
          resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'n', 'e', 'w']}
        >
          <div
            onClick={() => onSelect?.(chartId)}
            style={{ width: size.w, height: size.h, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', border: isSelected ? '2px solid #097cf7' : '1px solid #e2e8f0', transition: 'box-shadow 150ms, border 150ms', ...snapBorder }}
          >
            <div className="chart-drag-handle" style={{ cursor: 'grab', background: 'rgba(248,250,252,0.9)', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 32, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#002151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{config.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {isFetching && <Loader2 size={11} style={{ color: '#94a3b8', animation: 'spin 1s linear infinite' }} />}
                <button onClick={(e) => { e.stopPropagation(); refetch() }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Refresh"><RefreshCw size={11} /></button>
                <button onClick={(e) => { e.stopPropagation(); setFullscreen(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Fullscreen"><Maximize2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); unpinChart(chartId) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Remove from dashboard"><X size={12} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: COLORS.brandPrimary, color: '#fff' }}>{config.chartType.replace('-', ' ')}</span>
              <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{config.source.replace('_', ' ')} · {config.period ?? 'all time'}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {isFetching && !data ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, gap: 6 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
              ) : option ? (
                <ReactECharts ref={chartRef} option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>No data</div>
              )}
            </div>
          </div>
        </Resizable>

        {fullscreen && typeof document !== 'undefined' && createPortal(
          <motion.div className="fixed inset-0" style={{ zIndex: 998, background: 'rgba(0,10,26,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ width: '100%', maxWidth: 1100, height: '80vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#002151' }}>{config.name}</span>
                <button onClick={() => setFullscreen(false)} style={{ color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
                {fsOption && <ReactECharts option={fsOption} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />}
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
      </div>
    </Draggable>
  )
}

// ── Dashboard Tabs ───────────────────────────────────────────────────────────

function DashboardTabs({ dashboards, activeId }: { dashboards: Dashboard[]; activeId: string }) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const handleRenameStart = (db: Dashboard) => { setRenamingId(db.id); setNameDraft(db.name) }
  const handleRenameSave = () => { if (renamingId && nameDraft.trim()) renameDashboard(renamingId, nameDraft.trim()); setRenamingId(null) }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {dashboards.map((db) => {
        const isActive = db.id === activeId
        return (
          <div key={db.id} onClick={() => setActiveDashboardId(db.id)} onDoubleClick={() => handleRenameStart(db)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm font-medium transition-all duration-150 select-none ${isActive ? 'bg-brand-secondary text-white shadow-sm' : 'bg-white border border-border text-brand-secondary/70 hover:bg-brand-secondary/5'}`}>
            {renamingId === db.id ? (
              <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setRenamingId(null) }}
                onBlur={handleRenameSave} className="bg-transparent text-white outline-none w-24 text-sm font-medium" onClick={(e) => e.stopPropagation()} />
            ) : <span>{db.name}</span>}
            {isActive && dashboards.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); deleteDashboard(db.id) }} className="opacity-60 hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
            )}
          </div>
        )
      })}
      <button onClick={() => createDashboard('New Dashboard')} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-brand-secondary/60 border border-dashed border-border hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150">+ New</button>
    </div>
  )
}

// ── Export helper ─────────────────────────────────────────────────────────────

async function exportDashboard(gridRef: React.RefObject<HTMLDivElement | null>, format: 'png' | 'pdf') {
  if (!gridRef.current) return
  const { default: html2canvas } = await import('html2canvas-pro')
  const canvas = await html2canvas(gridRef.current, { backgroundColor: '#f8fafc', scale: 2, useCORS: true })

  if (format === 'png') {
    const link = document.createElement('a')
    link.download = `dashboard-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } else {
    const imgData = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Dashboard Export</title><style>@media print { @page { margin: 0.5cm; size: landscape; } body { margin: 0; } img { width: 100%; height: auto; } }</style></head><body><img src="${imgData}" /><script>setTimeout(()=>{window.print();window.close()},300)</script></body></html>`)
    w.document.close()
  }
}

// ── Seeding ──────────────────────────────────────────────────────────────────

function buildSeedCharts(data: CustomDashboardData): Omit<PinnedChart, 'pinnedAt'>[] {
  const recent = data.revenue_trend.slice(-6)
  return [
    { id: crypto.randomUUID(), title: 'Revenue Trend', headers: ['Month', 'Revenue'], rows: data.revenue_trend.map((d) => [d.month, String(d.revenue)]), chartType: 'line', sourceQuestion: 'demo', x: 0, y: 0, w: 888, h: 312 },
    { id: crypto.randomUUID(), title: 'Lifecycle Stage Distribution', headers: ['Stage', 'Count'], rows: data.lifecycle_distribution.map((d) => [d.stage, String(d.count)]), chartType: 'pie', sourceQuestion: 'demo', x: 912, y: 0, w: 432, h: 312 },
    { id: crypto.randomUUID(), title: 'Leads vs Customers', headers: ['Month', 'Leads', 'Customers'], rows: data.leads_customers_trend.map((d) => [d.month, String(d.leads), String(d.customers)]), chartType: 'bar', sourceQuestion: 'demo', x: 0, y: 336, w: 576, h: 312 },
    { id: crypto.randomUUID(), title: 'Recent Revenue (Last 6M)', headers: ['Month', 'Revenue'], rows: recent.map((d) => [d.month, String(d.revenue)]), chartType: 'area', sourceQuestion: 'demo', x: 600, y: 336, w: 744, h: 312 },
  ]
}

// ── Styles ───────────────────────────────────────────────────────────────────

const PAGE_STYLES = `
  .dot-grid-page {
    background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
    background-size: 24px 24px;
    min-height: calc(100vh - 100px);
  }
  .grid-canvas {
    border: 2px dashed rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    padding: 6px;
    transition: border-color 200ms;
  }
  .grid-canvas:hover {
    border-color: rgba(148, 163, 184, 0.45);
  }
  /* Raise dragged chart above others */
  .react-draggable-dragging { z-index: 100 !important; }
  /* react-resizable handles */
  .react-resizable { position: relative; }
  .react-resizable-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    z-index: 2;
  }
  .react-resizable-handle::after {
    content: "";
    position: absolute;
    width: 6px;
    height: 6px;
    border-right: 2px solid rgba(0,0,0,0.25);
    border-bottom: 2px solid rgba(0,0,0,0.25);
  }
  .react-resizable-handle-se { bottom: 2px; right: 2px; cursor: se-resize; }
  .react-resizable-handle-se::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-sw { bottom: 2px; left: 2px; cursor: sw-resize; }
  .react-resizable-handle-sw::after { bottom: 2px; left: 2px; transform: rotate(90deg); }
  .react-resizable-handle-ne { top: 2px; right: 2px; cursor: ne-resize; }
  .react-resizable-handle-ne::after { top: 2px; right: 2px; transform: rotate(-90deg); }
  .react-resizable-handle-nw { top: 2px; left: 2px; cursor: nw-resize; }
  .react-resizable-handle-nw::after { top: 2px; left: 2px; transform: rotate(180deg); }
  .react-resizable-handle-n { top: 0; left: 50%; margin-left: -7px; cursor: n-resize; }
  .react-resizable-handle-n::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-s { bottom: 0; left: 50%; margin-left: -7px; cursor: s-resize; }
  .react-resizable-handle-s::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-e { right: 0; top: 50%; margin-top: -7px; cursor: e-resize; }
  .react-resizable-handle-e::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-w { left: 0; top: 50%; margin-top: -7px; cursor: w-resize; }
  .react-resizable-handle-w::after { bottom: 2px; right: 2px; transform: rotate(90deg); }
`

// ── Main page ────────────────────────────────────────────────────────────────

function CustomDashboardContent() {
  const dashboards = useDashboards()
  const [activeId, setActiveId] = useState('')
  const { data: apiData, isSuccess: apiReady } = useCustomDashboardData()
  const exportAreaRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!exportAreaRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width)
    })
    ro.observe(exportAreaRef.current)
    setContainerWidth(exportAreaRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setActiveId(getActiveDashboardId())
    const handler = () => setActiveId(getActiveDashboardId())
    window.addEventListener('demo-dashboards-changed', handler)
    return () => window.removeEventListener('demo-dashboards-changed', handler)
  }, [])

  // Seed demo charts
  useEffect(() => {
    if (apiReady && apiData) {
      const seeded = isDashboardSeeded()
      const all = JSON.parse(localStorage.getItem('demo-dashboards') || '[]')
      const db = all[0]
      // Also re-seed if charts still have old grid-unit coordinates (w < 50 = grid units, not pixels)
      const hasOldUnits = db?.charts?.length > 0 && db.charts[0].w < 50
      const needsReseed = !seeded || !db || db.charts.length < 4 || hasOldUnits
      if (needsReseed) {
        localStorage.removeItem('demo-dashboard-seeded')
        seedDemoCharts(buildSeedCharts(apiData))
      }
    }
  }, [apiReady, apiData])

  const [sidebarMode, setSidebarMode] = useState<SidebarMode | 'closed'>('closed')
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [selectedCanvasChartId, setSelectedCanvasChartId] = useState<string | null>(null)

  const activeDashboard = dashboards.find((d) => d.id === activeId) ?? dashboards[0]
  const allCharts = activeDashboard?.charts ?? []
  const charts = allCharts.filter((c): c is PinnedChart => !('configId' in c))

  const handleDragStop = useCallback((id: string, x: number, y: number) => {
    if (!activeDashboard) return
    const updated = allCharts.map((c) => ({ i: c.id, x: c.id === id ? x : c.x, y: c.id === id ? y : c.y, w: c.w, h: c.h }))
    updateAllLayouts(activeDashboard.id, updated)
  }, [activeDashboard, allCharts])

  const handleResizeStop = useCallback((id: string, x: number, y: number, w: number, h: number) => {
    if (!activeDashboard) return
    const updated = allCharts.map((c) => c.id === id
      ? { i: c.id, x, y, w, h }
      : { i: c.id, x: c.x, y: c.y, w: c.w, h: c.h }
    )
    updateAllLayouts(activeDashboard.id, updated)
  }, [activeDashboard, allCharts])

  const handleExport = async (format: 'png' | 'pdf') => {
    setExporting(true)
    try { await exportDashboard(exportAreaRef, format) } finally { setExporting(false) }
  }

  // Canvas height: hugs the lowest chart + 1 dot padding, but user can drag the bottom handle to extend it
  const chartsBottom = allCharts.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  const [extraHeight, setExtraHeight] = useState(0)
  const canvasHeight = Math.max(chartsBottom + SNAP, chartsBottom + extraHeight)
  const canvasResizingRef = useRef(false)
  const canvasResizeStartRef = useRef({ y: 0, h: 0 })

  const handleCanvasResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    canvasResizingRef.current = true
    canvasResizeStartRef.current = { y: e.clientY, h: extraHeight }
    const onMove = (ev: MouseEvent) => {
      if (!canvasResizingRef.current) return
      const delta = ev.clientY - canvasResizeStartRef.current.y
      setExtraHeight(Math.max(0, snap(canvasResizeStartRef.current.h + delta)))
    }
    const onUp = () => {
      canvasResizingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [extraHeight])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES + `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` }} />

      <div className="dot-grid-page" style={{ marginRight: sidebarMode !== 'closed' ? 320 : 0, transition: 'margin-right 250ms ease' }}>
        <div className="container-page py-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {dashboards.length > 0 && <DashboardTabs dashboards={dashboards} activeId={activeId} />}
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                onClick={() => { setEditingConfigId(null); setSelectedCanvasChartId(null); setSidebarMode('new') }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand-primary text-white hover:opacity-90 transition-all duration-150"
              >
                <PlusCircle size={13} /> Build Chart
              </button>
              <button
                onClick={() => setSidebarMode((m) => m === 'library' ? 'closed' : 'library')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${sidebarMode === 'library' ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-white border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40'}`}
              >
                <BookOpen size={13} /> Library
              </button>
              {allCharts.length > 0 && (
                <>
                  <button onClick={() => handleExport('png')} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150 disabled:opacity-50">
                    <Image size={13} /> PNG
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150 disabled:opacity-50">
                    <Download size={13} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Grid canvas */}
          <div className="grid-canvas" ref={exportAreaRef} style={{ position: 'relative', height: canvasHeight, transition: 'height 80ms ease' }}>
            {allCharts.length === 0 ? (
              <motion.div className="flex flex-col items-center justify-center py-32 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center mb-4 shadow-sm border border-border">
                  <LayoutGrid size={28} className="text-brand-primary" />
                </div>
                <h3 className="text-base font-semibold text-brand-secondary mb-2">No charts yet</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  {apiReady ? 'Use "Build Chart" to create a chart, or wait for demo charts to load.' : 'Loading demo charts from the API...'}
                </p>
              </motion.div>
            ) : (
              allCharts.map((chart) =>
                'configId' in chart ? (
                  <DynamicChartContent
                    key={chart.id}
                    configId={chart.configId}
                    chartId={chart.id}
                    others={allCharts.filter((c) => c.id !== chart.id)}
                    containerWidth={containerWidth}
                    onDragStop={handleDragStop}
                    onResizeStop={handleResizeStop}
                    x={chart.x} y={chart.y} w={chart.w} h={chart.h}
                    pinnedAt={chart.pinnedAt}
                    isSelected={selectedCanvasChartId === chart.id}
                    onSelect={(id) => {
                      setSelectedCanvasChartId(id)
                      setEditingConfigId(chart.configId)
                      setSidebarMode('edit')
                    }}
                  />
                ) : (
                  <ChartItem
                    key={chart.id}
                    chart={chart as PinnedChart}
                    others={charts.filter((c) => c.id !== chart.id)}
                    containerWidth={containerWidth}
                    onDragStop={handleDragStop}
                    onResizeStop={handleResizeStop}
                  />
                )
              )
            )}
          </div>

          {/* Bottom drag handle — pull down to expand canvas */}
          {allCharts.length > 0 && (
            <div
              onMouseDown={handleCanvasResizeStart}
              style={{ height: 10, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, userSelect: 'none' }}
              title="Drag to expand"
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.4)', transition: 'background 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(9,124,247,0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,163,184,0.4)')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chart builder sidebar */}
      <AnimatePresence>
        {sidebarMode !== 'closed' && (
          <ChartBuilderSidebar
            mode={sidebarMode}
            editingConfigId={editingConfigId}
            activeId={activeId}
            onClose={() => { setSidebarMode('closed'); setEditingConfigId(null); setSelectedCanvasChartId(null) }}
            onSwitchMode={(m) => { setSidebarMode(m); if (m !== 'edit') setEditingConfigId(null) }}
            onEditConfig={(configId) => { setEditingConfigId(configId); setSidebarMode('edit') }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function CustomDashboardPage() {
  return (
    <Suspense>
      <CustomDashboardContent />
    </Suspense>
  )
}
