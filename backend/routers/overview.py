"""
Overview page endpoints.

GET /api/overview-kpis?period=  → KPI cards with delta vs prior period
GET /api/overview-trend?period= → Monthly leads & customers trend
"""
import logging
from datetime import timedelta
from typing import Literal

import pandas as pd
from fastapi import APIRouter, Depends, Query

from services.data_loader import get_data

logger = logging.getLogger(__name__)

router = APIRouter()

Period = Literal["L3M", "L6M", "YTD", "12M"]


def _filter_period(df: pd.DataFrame, date_col: str, period: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (current_df, prior_df) filtered by period.

    Parses the date column and returns:
    - current: rows within the requested period window
    - prior: the same-length window immediately before current
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col])

    # Use latest date in data as reference (handles historical data)
    today = df[date_col].max()

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

    current = df[df[date_col] >= start]
    prior = df[(df[date_col] >= prior_start) & (df[date_col] < prior_end)]
    return current, prior


@router.get("/api/overview-kpis")
def overview_kpis(
    period: str = Query(default="L6M"),
    data: dict = Depends(get_data),
):
    """Return KPI cards for the Overview page."""
    df = data.get("executive_dashboard", pd.DataFrame())
    if df.empty:
        return []

    df = df.copy()
    df["SNAPSHOT_DATE"] = pd.to_datetime(df["SNAPSHOT_DATE"], errors="coerce")
    df = df.dropna(subset=["SNAPSHOT_DATE"]).sort_values("SNAPSHOT_DATE")

    # Numeric casts
    num_cols = [
        "TOTAL_ANNUAL_REVENUE_EUR", "TOTAL_CUSTOMERS",
        "CONVERSION_RATE_PCT", "CRITICAL_RISK_RATE_PCT",
    ]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    current_df, prior_df = _filter_period(df, "SNAPSHOT_DATE", period)

    def _latest(frame: pd.DataFrame, col: str) -> float:
        if frame.empty or col not in frame.columns:
            return 0.0
        val = frame.sort_values("SNAPSHOT_DATE")[col].dropna()
        return float(val.iloc[-1]) if not val.empty else 0.0

    def _delta(curr_val: float, prior_val: float) -> float:
        if prior_val == 0:
            return 0.0
        return round((curr_val - prior_val) / abs(prior_val) * 100, 2)

    rev_curr = _latest(current_df, "TOTAL_ANNUAL_REVENUE_EUR")
    rev_prior = _latest(prior_df, "TOTAL_ANNUAL_REVENUE_EUR")

    cust_curr = _latest(current_df, "TOTAL_CUSTOMERS")
    cust_prior = _latest(prior_df, "TOTAL_CUSTOMERS")

    conv_curr = _latest(current_df, "CONVERSION_RATE_PCT")
    conv_prior = _latest(prior_df, "CONVERSION_RATE_PCT")

    risk_curr = _latest(current_df, "CRITICAL_RISK_RATE_PCT")
    risk_prior = _latest(prior_df, "CRITICAL_RISK_RATE_PCT")

    return [
        {
            "key": "total_revenue",
            "label": "Total Annual Revenue",
            "value": rev_curr,
            "delta": _delta(rev_curr, rev_prior),
            "format": "currency",
            "description": "Latest total annual recurring revenue across all customers",
            "formula": "Latest TOTAL_ANNUAL_REVENUE_EUR from executive_dashboard",
            "sources": ["executive_dashboard"],
        },
        {
            "key": "total_customers",
            "label": "Total Customers",
            "value": cust_curr,
            "delta": _delta(cust_curr, cust_prior),
            "format": "number",
            "description": "Total active customers as of the latest snapshot",
            "formula": "Latest TOTAL_CUSTOMERS from executive_dashboard",
            "sources": ["executive_dashboard"],
        },
        {
            "key": "conversion_rate",
            "label": "Conversion Rate",
            "value": conv_curr,
            "delta": _delta(conv_curr, conv_prior),
            "format": "percent",
            "description": "Lead-to-customer conversion rate for the selected period",
            "formula": "Latest CONVERSION_RATE_PCT from executive_dashboard",
            "sources": ["executive_dashboard"],
        },
        {
            "key": "critical_risk_rate",
            "label": "Critical Risk Rate",
            "value": risk_curr,
            "delta": _delta(risk_curr, risk_prior),
            "format": "percent",
            "description": "Percentage of customers classified as critical churn risk",
            "formula": "Latest CRITICAL_RISK_RATE_PCT from executive_dashboard",
            "sources": ["executive_dashboard"],
        },
    ]


@router.get("/api/overview-trend")
def overview_trend(
    period: str = Query(default="L6M"),
    data: dict = Depends(get_data),
):
    """Return monthly leads & customers trend."""
    df = data.get("executive_dashboard", pd.DataFrame())
    if df.empty:
        return []

    df = df.copy()
    df["SNAPSHOT_DATE"] = pd.to_datetime(df["SNAPSHOT_DATE"], errors="coerce")
    df["SNAPSHOT_MONTH"] = pd.to_datetime(df["SNAPSHOT_MONTH"], errors="coerce")
    df = df.dropna(subset=["SNAPSHOT_DATE"])

    df["LEADS_THIS_MONTH"] = pd.to_numeric(df["LEADS_THIS_MONTH"], errors="coerce")
    df["TOTAL_CUSTOMERS"] = pd.to_numeric(df["TOTAL_CUSTOMERS"], errors="coerce")

    current_df, _ = _filter_period(df, "SNAPSHOT_DATE", period)

    if current_df.empty:
        return []

    # Group by SNAPSHOT_MONTH, take last value per month
    current_df = current_df.sort_values("SNAPSHOT_DATE")
    monthly = (
        current_df.groupby(current_df["SNAPSHOT_MONTH"].dt.to_period("M"))
        .last()
        .reset_index(drop=True)
    )

    result = []
    for _, row in monthly.iterrows():
        month_val = row.get("SNAPSHOT_MONTH")
        if pd.isna(month_val):
            continue
        result.append({
            "month": pd.Timestamp(month_val).strftime("%Y-%m"),
            "leads": float(row["LEADS_THIS_MONTH"]) if pd.notna(row["LEADS_THIS_MONTH"]) else 0.0,
            "customers": float(row["TOTAL_CUSTOMERS"]) if pd.notna(row["TOTAL_CUSTOMERS"]) else 0.0,
        })

    return result
