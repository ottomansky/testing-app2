'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type {
  HealthResponse,
  PlatformInfo,
  UserMeResponse,
  OverviewKpiItem,
  OverviewTrendPoint,
  MarketingKpiItem,
  MarketingTrendPoint,
  MarketingTableRow,
  CustomDashboardData,
  DataSchema,
  QueryDataResponse,
} from './types'
import type { ChartConfig } from './chart-config-storage'

/*
 * API HOOKS — React Query wrappers for backend endpoints.
 *
 * Pattern:
 *   - Central apiFetch<T>(url) helper with error handling
 *   - Each endpoint → one useXxx() hook
 *   - queryKey includes ALL filter params (for cache isolation)
 *   - keepPreviousData for smooth transitions when filters change
 */

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${url} — ${body}`)
  }
  return res.json()
}

// ─── Base hooks ─────────────────────────────────────────────────────────────

export function useHealthCheck() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    staleTime: 30_000,
  })
}

export function useCurrentUser() {
  return useQuery<UserMeResponse>({
    queryKey: ['me'],
    queryFn: () => apiFetch('/api/me'),
    staleTime: 10 * 60 * 1000,
  })
}

export function usePlatformInfo() {
  return useQuery<PlatformInfo>({
    queryKey: ['platform'],
    queryFn: () => apiFetch('/api/platform'),
    staleTime: 60 * 60 * 1000,
  })
}

// ─── Overview Page ───────────────────────────────────────────────────────────

export function useOverviewKpis(period: string) {
  return useQuery<OverviewKpiItem[]>({
    queryKey: ['overview-kpis', period],
    queryFn: () => apiFetch(`/api/overview-kpis?period=${period}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useOverviewTrend(period: string) {
  return useQuery<OverviewTrendPoint[]>({
    queryKey: ['overview-trend', period],
    queryFn: () => apiFetch(`/api/overview-trend?period=${period}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

// ─── Marketing Page ──────────────────────────────────────────────────────────

export function useMarketingKpis(period: string) {
  return useQuery<MarketingKpiItem[]>({
    queryKey: ['marketing-kpis', period],
    queryFn: () => apiFetch(`/api/marketing-kpis?period=${period}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useMarketingTrend(period: string) {
  return useQuery<MarketingTrendPoint[]>({
    queryKey: ['marketing-trend', period],
    queryFn: () => apiFetch(`/api/marketing-trend?period=${period}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useMarketingTable(period: string) {
  return useQuery<MarketingTableRow[]>({
    queryKey: ['marketing-table', period],
    queryFn: () => apiFetch(`/api/marketing-table?period=${period}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

// ─── Custom Dashboard Page ───────────────────────────────────────────────────

export function useCustomDashboardData() {
  return useQuery<CustomDashboardData>({
    queryKey: ['custom-dashboard-data'],
    queryFn: () => apiFetch('/api/custom-dashboard-data'),
    staleTime: 5 * 60_000,
  })
}

// ─── Chart Builder ───────────────────────────────────────────────────────────

export function useDataSchema() {
  return useQuery<DataSchema>({
    queryKey: ['data-schema'],
    queryFn: () => apiFetch('/api/data-schema'),
    staleTime: Infinity,
  })
}

export function useQueryData(config: ChartConfig | null) {
  return useQuery<QueryDataResponse>({
    queryKey: ['query-data', config?.source, config?.dimension, config?.measures, config?.period],
    queryFn: () => {
      if (!config) throw new Error('No config')
      const params = new URLSearchParams({
        source: config.source,
        dimension: config.dimension,
        measures: config.measures.join(','),
      })
      if (config.period) params.set('period', config.period)
      return apiFetch(`/api/query-data?${params}`)
    },
    enabled: config !== null && config.measures.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}
