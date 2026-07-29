"""
Analytics API Routes
Provides aggregated statistics and metrics for dashboards
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from common.auth.jwt import TokenData, get_current_user
from common.db.database import get_db
from common.db.models import Alert, AlertStatus, AlertSeverity, AlertType, Outlet, SalesTransaction, UserRole

router = APIRouter()


# =============================================================================
# RESPONSE MODELS
# =============================================================================


class SalesSummary(BaseModel):
    """Daily sales summary"""
    date: str
    total_amount: float
    transaction_count: int
    avg_transaction: float


class SalesTrend(BaseModel):
    """Sales trend data"""
    period: str  # daily, weekly, monthly
    data: list[SalesSummary]
    total_amount: float
    total_transactions: int


class AlertSummary(BaseModel):
    """Alert summary statistics"""
    total: int
    by_status: dict[str, int]
    by_severity: dict[str, int]
    by_type: dict[str, int]


class OutletPerformance(BaseModel):
    """Outlet performance metrics"""
    outlet_id: int
    outlet_name: str
    outlet_code: str
    region: str
    sales_today: float
    sales_vs_target: float  # percentage
    alert_count: int
    anomaly_score: Optional[float] = None


class DashboardStats(BaseModel):
    """Overall dashboard statistics"""
    total_outlets: int
    active_outlets: int
    total_sales_today: float
    total_sales_vs_target: float
    total_alerts: int
    new_alerts: int
    critical_alerts: int
    avg_anomaly_score: Optional[float] = None


# =============================================================================
# ANALYTICS ENDPOINTS
# =============================================================================


@router.get(
    "/sales/summary",
    response_model=SalesTrend,
    summary="Get sales trend data"
)
async def get_sales_summary(
    period: str = Query("daily", description="Period: daily, weekly, monthly"),
    days: int = Query(7, ge=1, le=90, description="Number of days to include"),
    outlet_id: Optional[int] = Query(None, description="Filter by outlet"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get sales trend data for specified period.
    """
    # Build base date filter
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Build query
    query = select(
        func.date(SalesTransaction.date).label('date'),
        func.sum(SalesTransaction.amount).label('total_amount'),
        func.count(SalesTransaction.id).label('transaction_count'),
    ).where(
        SalesTransaction.date >= start_date,
        SalesTransaction.date <= end_date
    )
    
    # RBAC - outlet filter
    if outlet_id:
        query = query.where(SalesTransaction.outlet_id == outlet_id)
    elif current_user.role == UserRole.FRANCHISEE_OWNER.value:
        # Filter to user's outlets
        subq = select(Outlet.id).where(Outlet.franchisee_id == current_user.user_id)
        query = query.where(SalesTransaction.outlet_id.in_(subq))
    
    # Group by date
    query = query.group_by(func.date(SalesTransaction.date))
    query = query.order_by(func.date(SalesTransaction.date))
    
    result = await db.execute(query)
    rows = result.all()
    
    # Build response
    data = [
        SalesSummary(
            date=str(row.date),
            total_amount=float(row.total_amount or 0),
            transaction_count=int(row.transaction_count or 0),
            avg_transaction=float(row.total_amount / row.transaction_count) if row.transaction_count else 0
        )
        for row in rows
    ]
    
    total_amount = sum(d.total_amount for d in data)
    total_transactions = sum(d.transaction_count for d in data)
    
    return SalesTrend(
        period=period,
        data=data,
        total_amount=total_amount,
        total_transactions=total_transactions
    )


@router.get(
    "/alerts/summary",
    response_model=AlertSummary,
    summary="Get alert summary statistics"
)
async def get_alert_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
    outlet_id: Optional[int] = Query(None, description="Filter by outlet"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get alert summary statistics.
    """
    # Date filter
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Build query
    query = select(Alert).where(Alert.triggered_at >= start_date)
    
    # RBAC
    if outlet_id:
        query = query.where(Alert.outlet_id == outlet_id)
    elif current_user.role == UserRole.FRANCHISEE_OWNER.value:
        subq = select(Outlet.id).where(Outlet.franchisee_id == current_user.user_id)
        query = query.where(Alert.outlet_id.in_(subq))
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    # Count by status
    by_status = {}
    for s in AlertStatus:
        by_status[s.value] = sum(1 for a in alerts if a.status == s)
    
    # Count by severity
    by_severity = {}
    for s in AlertSeverity:
        by_severity[s.value] = sum(1 for a in alerts if a.severity == s)
    
    # Count by type
    by_type = {}
    for t in AlertType:
        by_type[t.value] = sum(1 for a in alerts if a.type == t)
    
    return AlertSummary(
        total=len(alerts),
        by_status=by_status,
        by_severity=by_severity,
        by_type=by_type
    )


@router.get(
    "/outlets/performance",
    response_model=list[OutletPerformance],
    summary="Get outlet performance metrics"
)
async def get_outlet_performance(
    region_id: Optional[int] = Query(None, description="Filter by region"),
    limit: int = Query(20, ge=1, le=100, description="Number of outlets"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get performance metrics for outlets.
    """
    # Build outlet query
    query = select(Outlet)
    
    # RBAC
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        query = query.where(Outlet.franchisee_id == current_user.user_id)
    elif region_id:
        query = query.where(Outlet.region_id == region_id)
    
    query = query.limit(limit)
    result = await db.execute(query)
    outlets = result.scalars().all()
    
    # Get today's sales and alerts for each outlet
    today = datetime.utcnow().date()
    performance_list = []
    
    for outlet in outlets:
        # Today's sales
        sales_result = await db.execute(
            select(
                func.coalesce(func.sum(SalesTransaction.amount), 0).label('total')
            ).where(
                SalesTransaction.outlet_id == outlet.id,
                func.date(SalesTransaction.date) == today
            )
        )
        sales_today = float(sales_result.scalar() or 0)
        
        # Alert count
        alerts_result = await db.execute(
            select(func.count(Alert.id)).where(
                Alert.outlet_id == outlet.id,
                Alert.status.in_([AlertStatus.NEW, AlertStatus.ACKNOWLEDGED])
            )
        )
        alert_count = alerts_result.scalar() or 0
        
        # Target (simplified - would come from settings)
        target = 10_000_000  # Rp 10jt/day
        
        performance_list.append(OutletPerformance(
            outlet_id=outlet.id,
            outlet_name=outlet.name,
            outlet_code=outlet.code,
            region=outlet.region.name if outlet.region else "",
            sales_today=sales_today,
            sales_vs_target=round((sales_today / target * 100) if target > 0 else 0, 1),
            alert_count=alert_count,
            anomaly_score=None  # Would compute from ML model
        ))
    
    return performance_list


@router.get(
    "/dashboard",
    response_model=DashboardStats,
    summary="Get dashboard statistics"
)
async def get_dashboard_stats(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get overall dashboard statistics.
    """
    today = datetime.utcnow().date()
    
    # Base outlet query
    outlet_query = select(Outlet)
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        outlet_query = outlet_query.where(Outlet.franchisee_id == current_user.user_id)
    outlet_result = await db.execute(outlet_query)
    outlets = outlet_result.scalars().all()
    outlet_ids = [o.id for o in outlets]
    
    # Outlet counts
    total_outlets = len(outlets)
    active_outlets = sum(1 for o in outlets if o.status.value == "ACTIVE")
    
    # Today's sales
    if outlet_ids:
        sales_result = await db.execute(
            select(func.coalesce(func.sum(SalesTransaction.amount), 0)).where(
                SalesTransaction.outlet_id.in_(outlet_ids),
                func.date(SalesTransaction.date) == today
            )
        )
        total_sales_today = float(sales_result.scalar() or 0)
        
        # Anomaly score avg
        anomaly_result = await db.execute(
            select(func.avg(SalesTransaction.anomaly_score)).where(
                SalesTransaction.outlet_id.in_(outlet_ids),
                func.date(SalesTransaction.date) == today
            )
        )
        avg_anomaly = float(anomaly_result.scalar() or 0) if anomaly_result.scalar() else None
    else:
        total_sales_today = 0
        avg_anomaly = None
    
    # Target
    target = total_outlets * 10_000_000
    total_vs_target = round((total_sales_today / target * 100) if target > 0 else 0, 1)
    
    # Alerts
    if outlet_ids:
        alert_query = select(Alert).where(Alert.outlet_id.in_(outlet_ids))
        alert_result = await db.execute(alert_query)
        alerts = alert_result.scalars().all()
    else:
        alerts = []
    
    total_alerts = len(alerts)
    new_alerts = sum(1 for a in alerts if a.status == AlertStatus.NEW)
    critical_alerts = sum(1 for a in alerts if a.severity == AlertSeverity.P0_CRITICAL)
    
    return DashboardStats(
        total_outlets=total_outlets,
        active_outlets=active_outlets,
        total_sales_today=total_sales_today,
        total_sales_vs_target=total_vs_target,
        total_alerts=total_alerts,
        new_alerts=new_alerts,
        critical_alerts=critical_alerts,
        avg_anomaly_score=avg_anomaly if avg_anomaly > 0 else None
    )
