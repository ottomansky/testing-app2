"""
Custom Dashboard endpoint.

GET /api/custom-dashboard-data → Pre-aggregated data for 3 demo charts:
  - revenue_trend:          monthly revenue from marketing_metrics
  - lifecycle_distribution: count by LIFECYCLE_STAGE from lifecycle_stages
  - leads_customers_trend:  monthly leads + customers from executive_dashboard
"""
import logging

import pandas as pd
from fastapi import APIRouter, Depends

from services.data_loader import get_data

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/custom-dashboard-data")
def custom_dashboard_data(data: dict = Depends(get_data)):
    """Return pre-aggregated data for the custom draggable dashboard."""

    # ── 1. Revenue trend from marketing_metrics ──────────────────────────────
    mm_df = data.get("marketing_metrics", pd.DataFrame())
    revenue_trend: list[dict] = []

    if not mm_df.empty:
        mm = mm_df.copy()
        mm["date"] = pd.to_datetime(mm["date"], errors="coerce")
        mm["revenue"] = pd.to_numeric(mm["revenue"], errors="coerce")
        mm = mm.dropna(subset=["date", "revenue"])
        mm["month"] = mm["date"].dt.to_period("M")

        monthly_rev = (
            mm.groupby("month")
            .agg(revenue=("revenue", "sum"))
            .reset_index()
            .sort_values("month")
        )
        revenue_trend = [
            {
                "month": str(row["month"]),
                "revenue": round(float(row["revenue"]), 2),
            }
            for _, row in monthly_rev.iterrows()
        ]

    # ── 2. Lifecycle distribution from lifecycle_stages ───────────────────────
    ls_df = data.get("lifecycle_stages", pd.DataFrame())
    lifecycle_distribution: list[dict] = []

    if not ls_df.empty:
        ls = ls_df.copy()
        if "LIFECYCLE_STAGE" in ls.columns:
            stage_counts = (
                ls.groupby("LIFECYCLE_STAGE")
                .size()
                .reset_index(name="count")
                .sort_values("count", ascending=False)
            )
            lifecycle_distribution = [
                {
                    "stage": str(row["LIFECYCLE_STAGE"]),
                    "count": int(row["count"]),
                }
                for _, row in stage_counts.iterrows()
            ]

    # ── 3. Leads + customers trend from executive_dashboard ──────────────────
    ed_df = data.get("executive_dashboard", pd.DataFrame())
    leads_customers_trend: list[dict] = []

    if not ed_df.empty:
        ed = ed_df.copy()
        ed["SNAPSHOT_DATE"] = pd.to_datetime(ed["SNAPSHOT_DATE"], errors="coerce")
        ed["SNAPSHOT_MONTH"] = pd.to_datetime(ed["SNAPSHOT_MONTH"], errors="coerce")
        ed["LEADS_THIS_MONTH"] = pd.to_numeric(ed["LEADS_THIS_MONTH"], errors="coerce")
        ed["TOTAL_CUSTOMERS"] = pd.to_numeric(ed["TOTAL_CUSTOMERS"], errors="coerce")
        ed = ed.dropna(subset=["SNAPSHOT_DATE"])
        ed = ed.sort_values("SNAPSHOT_DATE")

        # Take last snapshot per month
        monthly_ed = (
            ed.groupby(ed["SNAPSHOT_MONTH"].dt.to_period("M"))
            .last()
            .reset_index(drop=True)
            .sort_values("SNAPSHOT_MONTH")
        )

        for _, row in monthly_ed.iterrows():
            month_val = row.get("SNAPSHOT_MONTH")
            if pd.isna(month_val):
                continue
            leads_customers_trend.append({
                "month": pd.Timestamp(month_val).strftime("%Y-%m"),
                "leads": float(row["LEADS_THIS_MONTH"]) if pd.notna(row["LEADS_THIS_MONTH"]) else 0.0,
                "customers": float(row["TOTAL_CUSTOMERS"]) if pd.notna(row["TOTAL_CUSTOMERS"]) else 0.0,
            })

    return {
        "revenue_trend": revenue_trend,
        "lifecycle_distribution": lifecycle_distribution,
        "leads_customers_trend": leads_customers_trend,
    }
