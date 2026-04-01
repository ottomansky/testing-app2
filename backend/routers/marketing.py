"""
Marketing page endpoints.

GET /api/marketing-kpis?period=   → KPI cards with delta vs prior period
GET /api/marketing-trend?period=  → Monthly revenue vs ad costs
GET /api/marketing-table?period=  → Monthly marketing metrics table
"""
import logging
from datetime import timedelta

import pandas as pd
from fastapi import APIRouter, Depends, Query

from services.data_loader import get_data

logger = logging.getLogger(__name__)

router = APIRouter()


def _filter_marketing_period(
    df: pd.DataFrame, period: str
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (current_df, prior_df) for marketing_metrics filtered by period."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    # Use latest date in data as reference (handles historical data)
    today = df["date"].max()

    if period == "L3M":
        days = 90
        start = today - timedelta(days=days)
        prior_start = start - timedelta(days=days)
        prior_end = start
    elif period == "YTD":
        start = pd.Timestamp(today.year, 1, 1)
        days = (today - start).days
        prior_start = start - timedelta(days=days)
        prior_end = start
    elif period == "12M":
        days = 365
        start = today - timedelta(days=days)
        prior_start = start - timedelta(days=days)
        prior_end = start
    else:  # L6M default
        days = 180
        start = today - timedelta(days=days)
        prior_start = start - timedelta(days=days)
        prior_end = start

    current = df[df["date"] >= start]
    prior = df[(df["date"] >= prior_start) & (df["date"] < prior_end)]
    return current, prior


def _cast_marketing_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Cast all numeric columns in marketing_metrics from TEXT to float."""
    num_cols = [
        "orders", "google_costs", "meta_costs", "other_costs",
        "ad_costs", "cac", "mer", "revenue", "cost_of_goods_sold",
        "cm2", "cm3", "roi", "aov",
    ]
    df = df.copy()
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


@router.get("/api/marketing-kpis")
def marketing_kpis(
    period: str = Query(default="L6M"),
    data: dict = Depends(get_data),
):
    """Return KPI cards for the Marketing page."""
    df = data.get("marketing_metrics", pd.DataFrame())
    if df.empty:
        return []

    df = _cast_marketing_cols(df)
    current_df, prior_df = _filter_marketing_period(df, period)

    def _safe_sum(frame: pd.DataFrame, col: str) -> float:
        if frame.empty or col not in frame.columns:
            return 0.0
        return float(frame[col].sum(skipna=True))

    def _safe_avg(frame: pd.DataFrame, col: str) -> float:
        if frame.empty or col not in frame.columns:
            return 0.0
        val = frame[col].mean(skipna=True)
        return float(val) if pd.notna(val) else 0.0

    def _delta(curr_val: float, prior_val: float) -> float:
        if prior_val == 0:
            return 0.0
        return round((curr_val - prior_val) / abs(prior_val) * 100, 2)

    ad_curr = _safe_sum(current_df, "ad_costs")
    ad_prior = _safe_sum(prior_df, "ad_costs")

    roi_curr = _safe_avg(current_df, "roi")
    roi_prior = _safe_avg(prior_df, "roi")

    cac_curr = _safe_avg(current_df, "cac")
    cac_prior = _safe_avg(prior_df, "cac")

    aov_curr = _safe_avg(current_df, "aov")
    aov_prior = _safe_avg(prior_df, "aov")

    return [
        {
            "key": "ad_spend",
            "label": "Ad Spend",
            "value": ad_curr,
            "delta": _delta(ad_curr, ad_prior),
            "format": "currency",
            "description": "Total advertising costs for the selected period",
            "formula": "SUM(ad_costs) from marketing_metrics",
            "sources": ["marketing_metrics"],
        },
        {
            "key": "roi",
            "label": "ROI",
            "value": roi_curr,
            "delta": _delta(roi_curr, roi_prior),
            "format": "percent",
            "description": "Average return on investment for advertising spend",
            "formula": "AVG(roi) from marketing_metrics",
            "sources": ["marketing_metrics"],
        },
        {
            "key": "cac",
            "label": "CAC",
            "value": cac_curr,
            "delta": _delta(cac_curr, cac_prior),
            "format": "currency",
            "description": "Average customer acquisition cost",
            "formula": "AVG(cac) from marketing_metrics",
            "sources": ["marketing_metrics"],
        },
        {
            "key": "aov",
            "label": "AOV",
            "value": aov_curr,
            "delta": _delta(aov_curr, aov_prior),
            "format": "currency",
            "description": "Average order value for the selected period",
            "formula": "AVG(aov) from marketing_metrics",
            "sources": ["marketing_metrics"],
        },
    ]


@router.get("/api/marketing-trend")
def marketing_trend(
    period: str = Query(default="L6M"),
    data: dict = Depends(get_data),
):
    """Return monthly revenue vs ad costs for the bar+line chart."""
    df = data.get("marketing_metrics", pd.DataFrame())
    if df.empty:
        return []

    df = _cast_marketing_cols(df)
    current_df, _ = _filter_marketing_period(df, period)

    if current_df.empty:
        return []

    current_df = current_df.copy()
    current_df["month"] = current_df["date"].dt.to_period("M")

    monthly = (
        current_df.groupby("month")
        .agg(revenue=("revenue", "sum"), ad_costs=("ad_costs", "sum"))
        .reset_index()
        .sort_values("month")
    )

    return [
        {
            "month": str(row["month"]),
            "revenue": round(float(row["revenue"]) if pd.notna(row["revenue"]) else 0.0, 2),
            "ad_costs": round(float(row["ad_costs"]) if pd.notna(row["ad_costs"]) else 0.0, 2),
        }
        for _, row in monthly.iterrows()
    ]


@router.get("/api/marketing-table")
def marketing_table(
    period: str = Query(default="L6M"),
    data: dict = Depends(get_data),
):
    """Return monthly marketing metrics table rows."""
    df = data.get("marketing_metrics", pd.DataFrame())
    if df.empty:
        return []

    df = _cast_marketing_cols(df)
    current_df, _ = _filter_marketing_period(df, period)

    if current_df.empty:
        return []

    current_df = current_df.copy()
    current_df["month"] = current_df["date"].dt.to_period("M")

    monthly = (
        current_df.groupby("month")
        .agg(
            orders=("orders", "sum"),
            revenue=("revenue", "sum"),
            ad_costs=("ad_costs", "sum"),
            roi=("roi", "mean"),
            cac=("cac", "mean"),
            aov=("aov", "mean"),
        )
        .reset_index()
        .sort_values("month", ascending=False)
    )

    def _safe_round(val, decimals: int = 2) -> float:
        return round(float(val), decimals) if pd.notna(val) else 0.0

    return [
        {
            "date": str(row["month"]),
            "orders": _safe_round(row["orders"], 0),
            "revenue": _safe_round(row["revenue"]),
            "ad_costs": _safe_round(row["ad_costs"]),
            "roi": _safe_round(row["roi"]),
            "cac": _safe_round(row["cac"]),
            "aov": _safe_round(row["aov"]),
        }
        for _, row in monthly.iterrows()
    ]
