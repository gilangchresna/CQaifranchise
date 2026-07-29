"""
ML/AI API Routes
Handles ML model scoring, predictions, and AI explanations

Implements real statistical ML methods:
- Z-score anomaly detection with rolling window
- Stockout prediction using inventory velocity
- Feature engineering (rolling averages, trends, seasonality)
"""
import json
import math
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from common.auth.jwt import TokenData, get_current_user
from common.config import get_settings
from common.db.database import get_db
from common.db.models import (
    Alert, AlertType, AlertSeverity, AlertStatus,
    Inventory, MLFeature, MLPrediction, MLScore,
    MLModelVersion, Outlet, SalesTransaction
)

router = APIRouter()
settings = get_settings()

# =============================================================================
# ML CONSTANTS
# =============================================================================

Z_SCORE_THRESHOLD = 2.5  # Standard deviations for anomaly flag
MIN_DATA_POINTS = 5  # Minimum historical points for reliable statistics
ROLLING_WINDOW_DAYS = 30  # Default rolling window

# Stockout thresholds (days until stockout)
STOCKOUT_CRITICAL_DAYS = 3
STOCKOUT_WARNING_DAYS = 7

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class ScoreRequest(BaseModel):
    """Request to score/analyze data with ML model"""
    model_type: str = Field(
        default="anomaly_detection",
        description="Model type: anomaly_detection, stockout_prediction"
    )
    outlet_id: int = Field(..., description="Outlet ID to analyze")
    data: dict = Field(
        default_factory=dict,
        description="Additional data for scoring (e.g., {'date': '2024-01-15'})"
    )


class AnomalyScoreResult(BaseModel):
    """Anomaly detection result"""
    outlet_id: int
    anomaly_score: float = Field(..., ge=0, le=1, description="Score 0-1 (higher = more anomalous)")
    is_anomaly: bool
    confidence: float
    factors: list[str] = Field(default_factory=list, description="Contributing factors")
    recommendation: str
    z_score: Optional[float] = None
    avg_value: Optional[float] = None
    std_dev: Optional[float] = None
    percentile: Optional[int] = None
    data_points: Optional[int] = None


class StockoutRiskResult(BaseModel):
    """Stockout prediction result"""
    outlet_id: int
    sku: str
    risk_score: float = Field(..., ge=0, le=1, description="Risk score 0-1 (higher = more at risk)")
    days_until_stockout: Optional[int] = None
    recommended_restock: int
    confidence: float
    current_velocity: Optional[float] = None
    avg_daily_sales: Optional[float] = None
    trend: Optional[str] = None


class ScoreResponse(BaseModel):
    """Generic score response"""
    success: bool
    model_type: str
    model_version: str
    result: dict
    processing_time_ms: Optional[int] = None


class ModelInfo(BaseModel):
    """ML model information"""
    name: str
    version: str
    type: str
    is_production: bool
    trained_at: str
    metrics: Optional[dict] = None


# =============================================================================
# STATISTICAL ML FUNCTIONS
# =============================================================================


def calculate_statistics(values: list[float]) -> dict:
    """Calculate mean and standard deviation from a list of values."""
    if not values:
        return {"avg": 0.0, "std_dev": 0.0, "count": 0}
    
    n = len(values)
    avg = sum(values) / n
    variance = sum((x - avg) ** 2 for x in values) / n
    std_dev = math.sqrt(variance) if variance > 0 else 0.0
    
    return {"avg": avg, "std_dev": std_dev, "count": n}


def calculate_z_score(current: float, avg: float, std_dev: float) -> float:
    """Calculate z-score. Returns 0 if std_dev is 0 (no variation)."""
    if std_dev == 0:
        return 0.0
    return (current - avg) / std_dev


def calculate_percentile(values: list[float], current: float) -> int:
    """Calculate what percentile current value is relative to historical values."""
    if not values:
        return 50
    
    sorted_values = sorted(values)
    count = sum(1 for v in sorted_values if v < current)
    return int((count / len(sorted_values)) * 100)


def calculate_rolling_window(values: list[float], window_size: int) -> list[float]:
    """Calculate rolling window averages."""
    if len(values) < window_size:
        return values
    return [sum(values[i:i+window_size])/window_size for i in range(len(values) - window_size + 1)]


def calculate_trend_slope(values: list[float]) -> float:
    """Calculate linear trend slope using least squares."""
    if len(values) < 2:
        return 0.0
    
    n = len(values)
    x = list(range(n))
    x_mean = sum(x) / n
    y_mean = sum(values) / n
    
    numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
    
    if denominator == 0:
        return 0.0
    return numerator / denominator


def calculate_seasonal_factor(daily_values: dict[int, list[float]], day_of_week: int) -> float:
    """
    Calculate seasonal (day-of-week) factor.
    Returns multiplier relative to overall average.
    """
    all_values = [v for values in daily_values.values() for v in values]
    if not all_values:
        return 1.0
    
    overall_avg = sum(all_values) / len(all_values)
    if overall_avg == 0:
        return 1.0
    
    day_values = daily_values.get(day_of_week, [])
    if not day_values:
        return 1.0
    
    day_avg = sum(day_values) / len(day_values)
    return day_avg / overall_avg


def get_or_create_model_version(
    db: AsyncSession,
    model_type: str,
    model_name: str,
    metrics: dict
) -> MLModelVersion:
    """Get or create a production model version, storing metrics."""
    import asyncio
    
    # Check for existing production model
    result = asyncio.get_event_loop().run_until_complete(
        db.execute(
            select(MLModelVersion)
            .where(MLModelVersion.model_type == model_type)
            .where(MLModelVersion.is_production == True)
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update metrics
        existing.metrics = json.dumps(metrics)
        return existing
    
    # Create new model version
    new_model = MLModelVersion(
        model_name=model_name,
        version=f"v1.0.{int(time.time())}",
        model_type=model_type,
        metrics=json.dumps(metrics),
        is_production=True,
        trained_at=datetime.utcnow(),
        deployed_at=datetime.utcnow()
    )
    db.add(new_model)
    return new_model


# =============================================================================
# FEATURE ENGINEERING
# =============================================================================


async def compute_sales_features(
    db: AsyncSession,
    outlet_id: int,
    days: int = ROLLING_WINDOW_DAYS
) -> dict:
    """
    Compute features for sales anomaly detection.
    Returns rolling averages, trends, and seasonal factors.
    """
    start_date = datetime.utcnow() - timedelta(days=days * 2)  # Extra for rolling calcs
    
    # Fetch daily sales aggregates
    result = await db.execute(
        select(
            func.date(SalesTransaction.date).label('date'),
            func.sum(SalesTransaction.amount).label('total_amount'),
            func.count(SalesTransaction.id).label('tx_count'),
            func.extract('dow', SalesTransaction.date).label('day_of_week')
        )
        .where(SalesTransaction.outlet_id == outlet_id)
        .where(SalesTransaction.date >= start_date)
        .group_by(func.date(SalesTransaction.date), func.extract('dow', SalesTransaction.date))
        .order_by(func.date(SalesTransaction.date))
    )
    rows = result.all()
    
    if not rows:
        return {
            "rolling_avg_7d": None,
            "rolling_avg_14d": None,
            "rolling_avg_30d": None,
            "rolling_std_7d": None,
            "rolling_std_14d": None,
            "trend_slope": None,
            "seasonal_factor": None,
            "data_points": 0
        }
    
    amounts = [float(row.total_amount) for row in rows]
    data_points = len(amounts)
    
    # Calculate rolling averages
    rolling_avg_7d = sum(amounts[-7:]) / min(7, data_points) if data_points >= 1 else None
    rolling_avg_14d = sum(amounts[-14:]) / min(14, data_points) if data_points >= 1 else None
    rolling_avg_30d = sum(amounts) / data_points if data_points >= 1 else None
    
    # Calculate rolling standard deviations
    def calc_std_subset(data, window):
        if len(data) < window:
            return None
        subset = data[-window:]
        avg = sum(subset) / len(subset)
        variance = sum((x - avg) ** 2 for x in subset) / len(subset)
        return math.sqrt(variance)
    
    rolling_std_7d = calc_std_subset(amounts, 7)
    rolling_std_14d = calc_std_subset(amounts, 14)
    
    # Calculate trend
    trend_slope = calculate_trend_slope(amounts[-30:]) if data_points >= 2 else 0.0
    
    # Calculate seasonal factor (day of week)
    daily_by_dow: dict[int, list[float]] = {}
    for row in rows:
        dow = int(row.day_of_week)
        if dow not in daily_by_dow:
            daily_by_dow[dow] = []
        daily_by_dow[dow].append(float(row.total_amount))
    
    current_dow = datetime.utcnow().weekday()
    seasonal_factor = calculate_seasonal_factor(daily_by_dow, current_dow)
    
    return {
        "rolling_avg_7d": rolling_avg_7d,
        "rolling_avg_14d": rolling_avg_14d,
        "rolling_avg_30d": rolling_avg_30d,
        "rolling_std_7d": rolling_std_7d,
        "rolling_std_14d": rolling_std_14d,
        "trend_slope": trend_slope,
        "seasonal_factor": seasonal_factor,
        "data_points": data_points
    }


async def compute_inventory_velocity(
    db: AsyncSession,
    outlet_id: int,
    sku: Optional[str] = None
) -> dict:
    """
    Compute inventory velocity for stockout prediction.
    Returns average daily sales velocity and trend.
    """
    # Get sales data for the last 30 days
    start_date = datetime.utcnow() - timedelta(days=30)
    
    query = select(
        func.date(SalesTransaction.date).label('date'),
        func.sum(func.jsonb_array_length(
            func.cast(SalesTransaction.items, 'json')
        )).label('items_sold')
    ).where(
        SalesTransaction.outlet_id == outlet_id,
        SalesTransaction.date >= start_date
    )
    
    if sku:
        # Filter by SKU if specified (requires items JSON to have SKU)
        query = query.where(
            func.jsonb_path_exists(
                SalesTransaction.items.cast('jsonb'),
                f'$.[*] ? (@.sku == "{sku}")'
            )
        )
    
    result = await db.execute(
        query.group_by(func.date(SalesTransaction.date))
        .order_by(func.date(SalesTransaction.date))
    )
    rows = result.all()
    
    if not rows:
        return {
            "avg_daily_sales": 0.0,
            "current_velocity": 0.0,
            "trend": "stable",
            "data_points": 0
        }
    
    daily_sales = [float(row.items_sold or 0) for row in rows]
    avg_daily_sales = sum(daily_sales) / len(daily_sales)
    
    # Calculate current velocity (last 7 days)
    current_velocity = sum(daily_sales[-7:]) / min(7, len(daily_sales)) if daily_sales else 0.0
    
    # Calculate trend
    trend_slope = calculate_trend_slope(daily_sales)
    if trend_slope > 0.1:
        trend = "increasing"
    elif trend_slope < -0.1:
        trend = "decreasing"
    else:
        trend = "stable"
    
    return {
        "avg_daily_sales": avg_daily_sales,
        "current_velocity": current_velocity,
        "trend": trend,
        "trend_slope": trend_slope,
        "data_points": len(daily_sales)
    }


# =============================================================================
# ANOMALY DETECTION
# =============================================================================


async def detect_anomaly(
    db: AsyncSession,
    outlet_id: int,
    current_sales: Optional[float] = None
) -> AnomalyScoreResult:
    """
    Real Z-score based anomaly detection with rolling window.
    
    Uses historical sales data to compute statistics and detect anomalies.
    """
    # Get sales features
    features = await compute_sales_features(db, outlet_id)
    
    # Get historical amounts for detailed statistics
    start_date = datetime.utcnow() - timedelta(days=ROLLING_WINDOW_DAYS)
    result = await db.execute(
        select(SalesTransaction.amount)
        .where(SalesTransaction.outlet_id == outlet_id)
        .where(SalesTransaction.date >= start_date)
        .order_by(SalesTransaction.date)
    )
    historical_amounts = [float(row[0]) for row in result.all()]
    
    # Get rolling average (7-day is most reliable for daily patterns)
    avg = features.get("rolling_avg_7d") or features.get("rolling_avg_30d") or 0.0
    std_dev = features.get("rolling_std_7d") or features.get("rolling_std_14d") or avg * 0.3
    
    # Use current sales if provided, otherwise use today's total
    if current_sales is None:
        # Sum today's sales
        today = datetime.utcnow().date()
        today_result = await db.execute(
            select(func.sum(SalesTransaction.amount))
            .where(SalesTransaction.outlet_id == outlet_id)
            .where(func.date(SalesTransaction.date) == today)
        )
        current_sales = float(today_result.scalar() or 0)
    
    # Apply seasonal adjustment if we have the factor
    seasonal_factor = features.get("seasonal_factor") or 1.0
    adjusted_avg = avg * seasonal_factor
    
    # Calculate z-score
    z_score = calculate_z_score(current_sales, adjusted_avg, std_dev)
    is_anomaly = abs(z_score) > Z_SCORE_THRESHOLD
    percentile = calculate_percentile(historical_amounts, current_sales)
    
    # Calculate anomaly score (0-1)
    # Convert z-score to confidence-like score
    abs_z = abs(z_score)
    anomaly_score = min(1.0, abs_z / (Z_SCORE_THRESHOLD * 2)) if abs_z > 1 else abs_z / Z_SCORE_THRESHOLD * 0.5
    
    # Calculate confidence based on data quality
    data_points = features.get("data_points", 0)
    confidence = min(1.0, data_points / 30) if data_points > 0 else 0.5
    
    # Generate factors
    factors = []
    if abs_z < 1:
        factors.append("Sales within normal range")
    elif z_score > 0:
        factors.append(f"Sales {abs_z:.1f}σ above average - positive anomaly")
    else:
        factors.append(f"Sales {abs_z:.1f}σ below average - negative anomaly")
    
    if features.get("trend_slope"):
        trend = features["trend_slope"]
        if trend > 0.1:
            factors.append("Upward trend detected")
        elif trend < -0.1:
            factors.append("Downward trend detected")
    
    if seasonal_factor != 1.0:
        factors.append(f"Day-of-week seasonal factor: {seasonal_factor:.2f}")
    
    # Generate recommendation
    if abs_z < 1:
        recommendation = "Continue monitoring - sales within normal range"
    elif abs_z < 2:
        recommendation = "Monitor closely - minor deviation from expected pattern"
    elif abs_z < 2.5:
        recommendation = "Investigate - significant deviation detected"
    else:
        if z_score > 0:
            recommendation = "⚠️ CRITICAL: Unusually HIGH sales - verify data or identify cause (promotion, event)"
        else:
            recommendation = "⚠️ CRITICAL: Unusually LOW sales - check for operational issues"
    
    # Store score in database
    score_record = MLScore(
        outlet_id=outlet_id,
        model_type="anomaly_detection",
        score=anomaly_score,
        z_score=z_score,
        is_anomaly=is_anomaly,
        confidence=confidence,
        factors=json.dumps(factors),
        avg_value=adjusted_avg,
        std_dev=std_dev,
        percentile=percentile,
        data_points=data_points,
        scored_at=datetime.utcnow()
    )
    db.add(score_record)
    
    return AnomalyScoreResult(
        outlet_id=outlet_id,
        anomaly_score=round(anomaly_score, 4),
        is_anomaly=is_anomaly,
        confidence=round(confidence, 4),
        factors=factors,
        recommendation=recommendation,
        z_score=round(z_score, 4),
        avg_value=round(adjusted_avg, 2) if adjusted_avg else None,
        std_dev=round(std_dev, 2) if std_dev else None,
        percentile=percentile,
        data_points=data_points
    )


# =============================================================================
# STOCKOUT PREDICTION
# =============================================================================


async def predict_stockout(
    db: AsyncSession,
    outlet_id: int,
    sku: Optional[str] = None
) -> StockoutRiskResult:
    """
    Real stockout prediction using inventory velocity.
    
    Calculates risk based on:
    - Current inventory levels
    - Average daily sales velocity
    - Sales trend (increasing/decreasing demand)
    """
    # Get inventory
    query = select(Inventory).where(Inventory.outlet_id == outlet_id)
    if sku:
        query = query.where(Inventory.sku == sku)
    
    result = await db.execute(query)
    inventory = result.scalar_one_or_none()
    
    if not inventory:
        return StockoutRiskResult(
            outlet_id=outlet_id,
            sku=sku or "ALL",
            risk_score=0.0,
            days_until_stockout=None,
            recommended_restock=0,
            confidence=0.0,
            current_velocity=0.0,
            avg_daily_sales=0.0,
            trend="stable"
        )
    
    # Get velocity metrics
    velocity = await compute_inventory_velocity(db, outlet_id, sku)
    avg_daily_sales = velocity.get("avg_daily_sales", 1.0)
    current_velocity = velocity.get("current_velocity", avg_daily_sales)
    trend = velocity.get("trend", "stable")
    
    # Ensure we don't divide by zero
    if avg_daily_sales <= 0:
        avg_daily_sales = 1.0
    if current_velocity <= 0:
        current_velocity = avg_daily_sales
    
    # Calculate days until stockout
    # Use current velocity (last 7 days) for more accurate prediction
    days_until_stockout = int(inventory.current_stock / current_velocity) if current_velocity > 0 else 999
    
    # Calculate risk score (0-1, higher = more risk)
    if days_until_stockout <= STOCKOUT_CRITICAL_DAYS:
        risk_score = 0.9 + (STOCKOUT_CRITICAL_DAYS - days_until_stockout) * 0.02
    elif days_until_stockout <= STOCKOUT_WARNING_DAYS:
        risk_score = 0.5 + (STOCKOUT_WARNING_DAYS - days_until_stockout) * 0.05
    elif days_until_stockout <= 14:
        risk_score = 0.2 + (14 - days_until_stockout) * 0.02
    else:
        risk_score = max(0.0, (30 - days_until_stockout) / 30 * 0.2)
    
    risk_score = min(1.0, max(0.0, risk_score))
    
    # Calculate recommended restock
    # Target: 14 days of stock at current velocity, plus buffer
    target_stock = int(current_velocity * 14)
    recommended_restock = max(0, target_stock - inventory.current_stock)
    
    # Adjust for increasing trend
    if trend == "increasing":
        recommended_restock = int(recommended_restock * 1.3)  # 30% buffer
    elif trend == "decreasing":
        recommended_restock = int(recommended_restock * 0.8)  # 20% less
    
    # Calculate confidence based on data quality
    data_points = velocity.get("data_points", 0)
    confidence = min(1.0, data_points / 14) if data_points > 0 else 0.5
    
    # Store prediction in database
    prediction = MLPrediction(
        outlet_id=outlet_id,
        sku=sku,
        risk_score=risk_score,
        days_until_stockout=days_until_stockout if days_until_stockout < 999 else None,
        recommended_restock=recommended_restock,
        current_velocity=current_velocity,
        avg_daily_sales=avg_daily_sales,
        trend=trend,
        confidence=confidence,
        predicted_at=datetime.utcnow()
    )
    db.add(prediction)
    
    return StockoutRiskResult(
        outlet_id=outlet_id,
        sku=sku or inventory.sku,
        risk_score=round(risk_score, 4),
        days_until_stockout=days_until_stockout if days_until_stockout < 999 else None,
        recommended_restock=recommended_restock,
        confidence=round(confidence, 4),
        current_velocity=round(current_velocity, 2),
        avg_daily_sales=round(avg_daily_sales, 2),
        trend=trend
    )


# =============================================================================
# ML ENDPOINTS
# =============================================================================


@router.post(
    "/score",
    response_model=ScoreResponse,
    summary="Score data with ML model"
)
async def score_data(
    request: ScoreRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Score outlet data with specified ML model.
    
    **Model Types:**
    - `anomaly_detection`: Detect unusual sales patterns using Z-score
    - `stockout_prediction`: Predict inventory stockout risk using velocity analysis
    
    **Features:**
    - Rolling window statistics (7/14/30 day averages)
    - Trend detection (increasing/decreasing/stable)
    - Seasonal factors (day-of-week patterns)
    - Real-time scoring with confidence metrics
    """
    # Validate outlet exists
    outlet_result = await db.execute(
        select(Outlet).where(Outlet.id == request.outlet_id)
    )
    outlet = outlet_result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    start_time = time.time()
    
    # Get current sales from request data or calculate from DB
    current_sales = request.data.get("current_sales")
    
    # Run the appropriate ML model
    if request.model_type == "anomaly_detection":
        result = await detect_anomaly(db, request.outlet_id, current_sales)
    elif request.model_type == "stockout_prediction":
        sku = request.data.get("sku")
        result = await predict_stockout(db, request.outlet_id, sku)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model type: {request.model_type}"
        )
    
    # Get model version
    model_result = await db.execute(
        select(MLModelVersion)
        .where(MLModelVersion.model_type == request.model_type)
        .where(MLModelVersion.is_production == True)
    )
    model = model_result.scalar_one_or_none()
    model_version = model.version if model else f"{request.model_type}-v1.0"
    
    # Commit the score/prediction to database
    await db.commit()
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return ScoreResponse(
        success=True,
        model_type=request.model_type,
        model_version=model_version,
        result=result.model_dump(),
        processing_time_ms=processing_time
    )


@router.post(
    "/analyze/sales",
    summary="Analyze sales for anomalies"
)
async def analyze_sales_anomaly(
    outlet_id: int,
    start_date: str,
    end_date: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze historical sales data for anomalies over a date range.
    
    Returns detailed analysis with:
    - Rolling window statistics
    - Trend analysis
    - Day-of-week seasonality
    - Anomaly scores per day
    """
    # Validate outlet
    outlet_result = await db.execute(
        select(Outlet).where(Outlet.id == outlet_id)
    )
    outlet = outlet_result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # Parse dates
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    # Get transactions for date range
    result = await db.execute(
        select(SalesTransaction)
        .where(SalesTransaction.outlet_id == outlet_id)
        .where(SalesTransaction.date >= start)
        .where(SalesTransaction.date <= end)
        .order_by(SalesTransaction.date)
    )
    transactions = result.scalars().all()
    
    if not transactions:
        return {
            "outlet_id": outlet_id,
            "outlet_name": outlet.name,
            "period": {"start": start_date, "end": end_date},
            "transaction_count": 0,
            "analysis": {
                "mean_amount": 0,
                "std_deviation": 0,
                "anomalies_detected": 0,
                "trend": "insufficient_data"
            },
            "daily_analysis": []
        }
    
    # Compute features
    features = await compute_sales_features(db, outlet_id)
    
    # Analyze each day
    daily_amounts = {}
    for tx in transactions:
        date_key = tx.date.date().isoformat()
        if date_key not in daily_amounts:
            daily_amounts[date_key] = []
        daily_amounts[date_key].append(tx.amount)
    
    daily_analysis = []
    all_amounts = []
    anomalies_detected = 0
    
    for date_key, amounts in sorted(daily_amounts.items()):
        daily_total = sum(amounts)
        all_amounts.append(daily_total)
        
        # Get historical average (exclude current day)
        historical = [a for d, a in daily_amounts.items() if d != date_key for a in daily_amounts[d]]
        
        stats = calculate_statistics(historical)
        z_score = calculate_z_score(daily_total, stats["avg"], stats["std_dev"])
        is_anomaly = abs(z_score) > Z_SCORE_THRESHOLD
        
        if is_anomaly:
            anomalies_detected += 1
        
        daily_analysis.append({
            "date": date_key,
            "total_amount": round(daily_total, 2),
            "transaction_count": len(amounts),
            "z_score": round(z_score, 4),
            "is_anomaly": is_anomaly,
            "percentile": calculate_percentile(historical, daily_total)
        })
    
    # Overall statistics
    overall_stats = calculate_statistics(all_amounts)
    trend_slope = calculate_trend_slope(all_amounts)
    
    if trend_slope > 0.1:
        trend = "increasing"
    elif trend_slope < -0.1:
        trend = "decreasing"
    else:
        trend = "stable"
    
    return {
        "outlet_id": outlet_id,
        "outlet_name": outlet.name,
        "period": {"start": start_date, "end": end_date},
        "transaction_count": len(transactions),
        "analysis": {
            "mean_amount": round(overall_stats["avg"], 2),
            "std_deviation": round(overall_stats["std_dev"], 2),
            "anomalies_detected": anomalies_detected,
            "trend": trend,
            "trend_slope": round(trend_slope, 4),
            "seasonal_factor": round(features.get("seasonal_factor", 1.0), 2)
        },
        "features": {
            "rolling_avg_7d": round(features.get("rolling_avg_7d"), 2) if features.get("rolling_avg_7d") else None,
            "rolling_avg_14d": round(features.get("rolling_avg_14d"), 2) if features.get("rolling_avg_14d") else None,
            "data_points": features.get("data_points", 0)
        },
        "daily_analysis": daily_analysis
    }


@router.post(
    "/predict/stockout",
    summary="Predict stockout risk"
)
async def predict_stockout_endpoint(
    outlet_id: int,
    sku: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Predict inventory stockout risk for an outlet.
    
    Returns risk scores and recommendations for restocking based on:
    - Current inventory levels
    - Sales velocity (units/day)
    - Sales trend analysis
    """
    # Validate outlet
    outlet_result = await db.execute(
        select(Outlet).where(Outlet.id == outlet_id)
    )
    outlet = outlet_result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # Get inventory items
    query = select(Inventory).where(Inventory.outlet_id == outlet_id)
    if sku:
        query = query.where(Inventory.sku == sku)
    
    result = await db.execute(query)
    inventory_items = result.scalars().all()
    
    if not inventory_items:
        return {
            "outlet_id": outlet_id,
            "outlet_name": outlet.name,
            "predictions": [],
            "message": "No inventory items found for this outlet"
        }
    
    # Predict stockout for each item
    predictions = []
    for item in inventory_items:
        prediction = await predict_stockout(db, outlet_id, item.sku)
        predictions.append({
            "sku": item.sku,
            "product_name": item.product_name,
            "current_stock": item.current_stock,
            "risk_score": prediction.risk_score,
            "days_until_stockout": prediction.days_until_stockout,
            "recommended_restock": prediction.recommended_restock,
            "current_velocity": prediction.current_velocity,
            "trend": prediction.trend,
            "confidence": prediction.confidence
        })
    
    # Commit predictions
    await db.commit()
    
    # Summary statistics
    high_risk_count = sum(1 for p in predictions if p["risk_score"] >= 0.7)
    medium_risk_count = sum(1 for p in predictions if 0.3 <= p["risk_score"] < 0.7)
    
    return {
        "outlet_id": outlet_id,
        "outlet_name": outlet.name,
        "predictions": predictions,
        "summary": {
            "total_items": len(predictions),
            "high_risk": high_risk_count,
            "medium_risk": medium_risk_count,
            "low_risk": len(predictions) - high_risk_count - medium_risk_count
        }
    }


@router.get(
    "/models",
    response_model=list[ModelInfo],
    summary="List available ML models"
)
async def list_models(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List available ML models and their versions.
    """
    result = await db.execute(
        select(MLModelVersion).order_by(
            MLModelVersion.model_name,
            MLModelVersion.is_production.desc()
        )
    )
    models = result.scalars().all()
    
    return [
        ModelInfo(
            name=m.model_name,
            version=m.version,
            type=m.model_type,
            is_production=m.is_production,
            trained_at=m.trained_at.isoformat(),
            metrics=json.loads(m.metrics) if m.metrics else None
        )
        for m in models
    ]


@router.get(
    "/models/{model_type}/latest",
    summary="Get latest production model"
)
async def get_latest_model(
    model_type: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the latest production model for a given type.
    """
    result = await db.execute(
        select(MLModelVersion)
        .where(MLModelVersion.model_type == model_type)
        .where(MLModelVersion.is_production == True)
        .order_by(MLModelVersion.deployed_at.desc())
        .limit(1)
    )
    model = result.scalar_one_or_none()
    
    if not model:
        raise HTTPException(
            status_code=404,
            detail=f"No production model found for type: {model_type}"
        )
    
    return ModelInfo(
        name=model.model_name,
        version=model.version,
        type=model.model_type,
        is_production=model.is_production,
        trained_at=model.trained_at.isoformat(),
        metrics=json.loads(model.metrics) if model.metrics else None
    )


@router.get(
    "/scores/{outlet_id}/history",
    summary="Get ML score history for outlet"
)
async def get_score_history(
    outlet_id: int,
    model_type: Optional[str] = "anomaly_detection",
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get historical ML scores for an outlet.
    """
    result = await db.execute(
        select(MLScore)
        .where(MLScore.outlet_id == outlet_id)
        .where(MLScore.model_type == model_type)
        .order_by(MLScore.scored_at.desc())
        .limit(limit)
    )
    scores = result.scalars().all()
    
    return {
        "outlet_id": outlet_id,
        "model_type": model_type,
        "count": len(scores),
        "scores": [
            {
                "id": s.id,
                "score": s.score,
                "z_score": s.z_score,
                "is_anomaly": s.is_anomaly,
                "confidence": s.confidence,
                "factors": json.loads(s.factors) if s.factors else [],
                "avg_value": s.avg_value,
                "std_dev": s.std_dev,
                "percentile": s.percentile,
                "scored_at": s.scored_at.isoformat()
            }
            for s in scores
        ]
    }
