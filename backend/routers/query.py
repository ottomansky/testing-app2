from __future__ import annotations

from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from services.data_loader import _DATA
import pandas as pd

router = APIRouter()

# ── Schema ────────────────────────────────────────────────────────────────────
# Single source of truth: allowlists + aggregation strategy per measure.
# 'sum' for flows (revenue, costs, counts); 'mean' for rates/ratios (roi, cac).

SCHEMA = {
    "marketing_metrics": {
        "date_col": "date",
        "dimensions": {"date"},
        "measures": {
            "revenue": "sum",
            "ad_costs": "sum",
            "orders": "sum",
            "cac": "mean",
            "mer": "mean",
            "roi": "mean",
            "aov": "mean",
            "cm2": "sum",
            "cm3": "sum",
            "cost_of_goods_sold": "sum",
        },
        "supports_period": True,
    },
    "executive_dashboard": {
        "date_col": "SNAPSHOT_MONTH",
        "dimensions": {"SNAPSHOT_MONTH"},
        "measures": {
            "TOTAL_ANNUAL_REVENUE_EUR": "sum",
            "TOTAL_CUSTOMERS": "sum",
            "CONVERSION_RATE_PCT": "mean",
            "CRITICAL_RISK_RATE_PCT": "mean",
            "LEADS_THIS_MONTH": "sum",
        },
        "supports_period": True,
    },
    "lifecycle_stages": {
        "date_col": None,
        "dimensions": {"LIFECYCLE_STAGE"},
        "measures": {"count": "sum"},
        "supports_period": False,
    },
}

DATA_SCHEMA_RESPONSE = {
    "sources": [
        {
            "id": "marketing_metrics",
            "label": "Marketing Metrics",
            "dimensions": [{"column": "date", "label": "Date", "is_date": True}],
            "measures": [
                {"column": "revenue", "label": "Revenue"},
                {"column": "ad_costs", "label": "Ad Costs"},
                {"column": "orders", "label": "Orders"},
                {"column": "cac", "label": "CAC"},
                {"column": "mer", "label": "MER"},
                {"column": "roi", "label": "ROI"},
                {"column": "aov", "label": "AOV"},
                {"column": "cm2", "label": "CM2"},
                {"column": "cm3", "label": "CM3"},
            ],
            "supports_period": True,
        },
        {
            "id": "executive_dashboard",
            "label": "Overview / Executive",
            "dimensions": [{"column": "SNAPSHOT_MONTH", "label": "Month", "is_date": True}],
            "measures": [
                {"column": "TOTAL_ANNUAL_REVENUE_EUR", "label": "Annual Revenue"},
                {"column": "TOTAL_CUSTOMERS", "label": "Customers"},
                {"column": "CONVERSION_RATE_PCT", "label": "Conversion Rate"},
                {"column": "CRITICAL_RISK_RATE_PCT", "label": "Critical Risk Rate"},
                {"column": "LEADS_THIS_MONTH", "label": "Leads"},
            ],
            "supports_period": True,
        },
        {
            "id": "lifecycle_stages",
            "label": "Lifecycle Stages",
            "dimensions": [{"column": "LIFECYCLE_STAGE", "label": "Stage"}],
            "measures": [{"column": "count", "label": "Count"}],
            "supports_period": False,
        },
    ]
}


def _filter_period(df: pd.DataFrame, date_col: str, period: str | None) -> pd.DataFrame:
    """Filter dataframe to the requested period window using the latest date as reference."""
    if period is None or date_col not in df.columns:
        return df
    try:
        dates = pd.to_datetime(df[date_col], errors="coerce")
        latest = dates.max()
        if pd.isna(latest):
            return df
        ref = latest.date() if hasattr(latest, "date") else latest
        today = ref
        if period == "L3M":
            cutoff = today - timedelta(days=90)
        elif period == "L6M":
            cutoff = today - timedelta(days=180)
        elif period == "YTD":
            cutoff = date(today.year, 1, 1)
        elif period == "12M":
            cutoff = today - timedelta(days=365)
        else:
            return df
        mask = pd.to_datetime(df[date_col], errors="coerce").dt.date >= cutoff
        return df.loc[mask]
    except Exception:
        return df


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/data-schema")
def get_data_schema():
    return DATA_SCHEMA_RESPONSE


@router.get("/api/query-data")
def query_data(
    source: str = Query(...),
    dimension: str = Query(...),
    measures: str = Query(...),
    period: str | None = Query(default=None),
):
    # Validate source
    if source not in SCHEMA:
        raise HTTPException(status_code=422, detail=f"Invalid source: {source}")
    schema = SCHEMA[source]

    # Validate dimension
    if dimension not in schema["dimensions"]:
        raise HTTPException(status_code=422, detail=f"Invalid dimension '{dimension}' for source '{source}'")

    # Validate measures
    measure_list = [m.strip() for m in measures.split(",") if m.strip()]
    if not measure_list:
        raise HTTPException(status_code=422, detail="At least one measure is required")
    invalid = [m for m in measure_list if m not in schema["measures"]]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid measures: {invalid}")

    # Get dataframe
    table_key = source
    df = _DATA.get(table_key)
    if df is None or df.empty:
        return {"headers": [dimension] + measure_list, "rows": []}

    # Special handling for lifecycle_stages (virtual 'count' measure)
    if source == "lifecycle_stages":
        result = df.groupby(dimension).size().reset_index(name="count")
        result = result[[dimension, "count"]]
        headers = [dimension, "count"]
        rows = [[str(row[dimension]), str(row["count"])] for _, row in result.iterrows()]
        return {"headers": headers, "rows": rows}

    # Apply period filter
    date_col = schema["date_col"]
    if schema["supports_period"] and period:
        df = _filter_period(df, date_col, period)

    # Check required columns exist
    missing = [c for c in [dimension] + measure_list if c not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"Columns not found in data: {missing}")

    # Aggregate: group by dimension, apply per-measure aggregation
    agg_dict = {m: schema["measures"][m] for m in measure_list}

    # For date dimensions, format to YYYY-MM
    df = df.copy()
    if dimension == date_col and date_col is not None:
        df[dimension] = pd.to_datetime(df[dimension], errors="coerce").dt.to_period("M").astype(str)

    grouped = df.groupby(dimension, sort=True).agg(agg_dict).reset_index()

    headers = [dimension] + measure_list
    rows = []
    for _, row in grouped.iterrows():
        rows.append([str(row[dimension])] + [f"{row[m]:.2f}" if isinstance(row[m], float) else str(row[m]) for m in measure_list])

    return {"headers": headers, "rows": rows}
