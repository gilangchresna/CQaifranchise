"""
Outlets API Routes
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from common.auth.jwt import TokenData, get_current_user
from common.db.database import get_db
from common.db.models import Alert, AlertStatus, Outlet, Region, SalesTransaction, UserRole

router = APIRouter()


class OutletResponse(BaseModel):
    id: int
    name: str
    code: str
    region_id: int
    region_name: str
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True


class OutletKPISummary(BaseModel):
    outlet_id: int
    outlet_name: str
    sales_today: float
    sales_7d_avg: float
    sales_target: float
    vs_target_pct: float
    alert_count: int
    anomaly_score: Optional[float] = None


class OutletListResponse(BaseModel):
    data: list[OutletResponse]
    meta: dict


@router.get("", response_model=OutletListResponse)
async def list_outlets(
    region_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List outlets (filtered by role)"""
    # Build query
    query = select(Outlet).join(Region)
    
    # RBAC: Franchisee only sees their outlets
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        query = query.where(Outlet.franchisee_id == current_user.user_id)
    elif region_id:
        query = query.where(Outlet.region_id == region_id)
    
    if status:
        query = query.where(Outlet.status == status)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    outlets = result.scalars().all()
    
    return OutletListResponse(
        data=[
            OutletResponse(
                id=o.id,
                name=o.name,
                code=o.code,
                region_id=o.region_id,
                region_name=o.region.name if o.region else "",
                status=o.status.value,
                latitude=o.latitude,
                longitude=o.longitude,
            )
            for o in outlets
        ],
        meta={
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    )


@router.get("/{outlet_id}", response_model=OutletResponse)
async def get_outlet(
    outlet_id: int,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get outlet details"""
    result = await db.execute(
        select(Outlet)
        .join(Region)
        .where(Outlet.id == outlet_id)
    )
    outlet = result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # RBAC check
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        if outlet.franchisee_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return OutletResponse(
        id=outlet.id,
        name=outlet.name,
        code=outlet.code,
        region_id=outlet.region_id,
        region_name=outlet.region.name,
        status=outlet.status.value,
        latitude=outlet.latitude,
        longitude=outlet.longitude,
    )


@router.get("/{outlet_id}/kpi-summary")
async def get_outlet_kpi_summary(
    outlet_id: int,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get KPI summary for an outlet"""
    # Get outlet
    result = await db.execute(select(Outlet).where(Outlet.id == outlet_id))
    outlet = result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # RBAC check
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        if outlet.franchisee_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get sales data (simplified - would use proper date filtering in production)
    from datetime import datetime, timedelta
    
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    
    # Today's sales
    sales_today_result = await db.execute(
        select(func.sum(SalesTransaction.amount))
        .where(SalesTransaction.outlet_id == outlet_id)
        .where(func.date(SalesTransaction.date) == today)
    )
    sales_today = sales_today_result.scalar() or 0.0
    
    # 7-day average
    sales_7d_result = await db.execute(
        select(func.avg(SalesTransaction.amount))
        .where(SalesTransaction.outlet_id == outlet_id)
        .where(func.date(SalesTransaction.date) >= week_ago)
    )
    sales_7d_avg = sales_7d_result.scalar() or 0.0
    
    # Active alerts count
    alerts_count_result = await db.execute(
        select(func.count(Alert.id))
        .where(Alert.outlet_id == outlet_id)
        .where(Alert.status.in_([AlertStatus.NEW, AlertStatus.ACKNOWLEDGED]))
    )
    alert_count = alerts_count_result.scalar() or 0
    
    # Target (would be from settings in production)
    sales_target = 10_000_000  # Rp 10jt/day
    
    return {
        "outlet_id": outlet.id,
        "outlet_name": outlet.name,
        "sales_today": sales_today,
        "sales_7d_avg": sales_7d_avg,
        "sales_target": sales_target,
        "vs_target_pct": round((sales_today / sales_target * 100) if sales_target > 0 else 0, 1),
        "alert_count": alert_count,
        "anomaly_score": None,
    }
