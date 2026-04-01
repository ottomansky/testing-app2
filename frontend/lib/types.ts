/*
 * API RESPONSE TYPES
 *
 * One interface per endpoint response. Keep in sync with backend.
 */

// ─── Base ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  tables_loaded?: number
}

export interface PlatformInfo {
  connection_url: string | null
  project_id: string | null
}

export interface UserMeResponse {
  email: string
  role: string
  is_authenticated: boolean
}

// ─── Overview Page ───────────────────────────────────────────────────────────

/**
 * GET /api/overview-kpis?period=
 * Returns an array of KPI items for the Overview page.
 */
export interface OverviewKpiItem {
  key: string
  label: string
  value: number
  delta: number
  format: 'currency' | 'percent' | 'number'
  description: string
  formula: string
  sources: string[]
}

/**
 * GET /api/overview-trend?period=
 * Monthly leads & customers trend data.
 */
export interface OverviewTrendPoint {
  month: string
  leads: number
  customers: number
}

// ─── Marketing Page ──────────────────────────────────────────────────────────

/**
 * GET /api/marketing-kpis?period=
 * Returns an array of KPI items for the Marketing page.
 */
export interface MarketingKpiItem {
  key: string
  label: string
  value: number
  delta: number
  format: 'currency' | 'percent' | 'number'
  description: string
  formula: string
  sources: string[]
}

/**
 * GET /api/marketing-trend?period=
 * Revenue vs Ad Costs over time.
 */
export interface MarketingTrendPoint {
  month: string
  revenue: number
  ad_costs: number
}

/**
 * GET /api/marketing-table?period=
 * Monthly marketing metrics table rows.
 */
export interface MarketingTableRow {
  date: string
  orders: number
  revenue: number
  ad_costs: number
  roi: number
  cac: number
  aov: number
}

// ─── Custom Dashboard Page ───────────────────────────────────────────────────

/**
 * GET /api/custom-dashboard-data
 * Pre-populated demo chart data.
 */
export interface RevenueTrendPoint {
  month: string
  revenue: number
}

export interface LifecycleDistributionItem {
  stage: string
  count: number
}

export interface LeadsCustomersTrendPoint {
  month: string
  leads: number
  customers: number
}

export interface CustomDashboardData {
  revenue_trend: RevenueTrendPoint[]
  lifecycle_distribution: LifecycleDistributionItem[]
  leads_customers_trend: LeadsCustomersTrendPoint[]
}

export interface DataSchemaField {
  column: string
  label: string
  is_date?: boolean
}

export interface DataSchemaSource {
  id: string
  label: string
  dimensions: DataSchemaField[]
  measures: DataSchemaField[]
  supports_period: boolean
}

export interface DataSchema {
  sources: DataSchemaSource[]
}

export interface QueryDataResponse {
  headers: string[]
  rows: string[][]
}
