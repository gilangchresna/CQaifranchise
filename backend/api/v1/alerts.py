"""
Alerts API Routes
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from common.auth.jwt import TokenData, get_current_user
from common.db.database import get_db
from common.db.models import Alert, AlertStatus, AlertSeverity, AlertType, Case, Outlet, UserRole

router = APIRouter()


class AlertResponse(BaseModel):
    id: int
    outlet_id: int
    outlet_name: str
    type: str
    severity: str
    status: str
    title: str
    description: Optional[str] = None
    score: Optional[float] = None
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    data: list[AlertResponse]
    meta: dict


class AcknowledgeRequest(BaseModel):
    notes: Optional[str] = None


class ResolveRequest(BaseModel):
    resolution_notes: str


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    outlet_id: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List alerts (filtered by role and filters)"""
    query = select(Alert).join(Outlet)
    
    # RBAC
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        query = query.where(Outlet.franchisee_id == current_user.user_id)
    elif current_user.role == UserRole.REGIONAL_MANAGER.value:
        query = query.join(Outlet).where(Outlet.region_id == region_id)  # Would use user's region
    
    # Filters
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    if alert_type:
        query = query.where(Alert.type == alert_type)
    if outlet_id:
        query = query.where(Alert.outlet_id == outlet_id)
    if start_date:
        query = query.where(Alert.triggered_at >= start_date)
    if end_date:
        query = query.where(Alert.triggered_at <= end_date)
    
    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Paginate
    query = query.order_by(Alert.triggered_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return AlertListResponse(
        data=[
            AlertResponse(
                id=a.id,
                outlet_id=a.outlet_id,
                outlet_name=a.outlet.name if a.outlet else "",
                type=a.type.value,
                severity=a.severity.value,
                status=a.status.value,
                title=a.title,
                description=a.description,
                score=a.score,
                triggered_at=a.triggered_at,
                acknowledged_at=a.acknowledged_at,
                resolved_at=a.resolved_at,
            )
            for a in alerts
        ],
        meta={
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    )


@router.get("/{alert_id}")
async def get_alert(
    alert_id: int,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get alert details"""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # RBAC check
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        if alert.outlet.franchisee_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return AlertResponse(
        id=alert.id,
        outlet_id=alert.outlet_id,
        outlet_name=alert.outlet.name if alert.outlet else "",
        type=alert.type.value,
        severity=alert.severity.value,
        status=alert.status.value,
        title=alert.title,
        description=alert.description,
        score=alert.score,
        triggered_at=alert.triggered_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
    )


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    request: AcknowledgeRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an alert"""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert.status != AlertStatus.NEW:
        raise HTTPException(
            status_code=400,
            detail=f"Alert is already {alert.status.value}"
        )
    
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Alert acknowledged", "status": alert.status.value}


@router.patch("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    request: ResolveRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve an alert"""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Update alert
    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.utcnow()
    
    # Create or update case
    case = Case(
        alert_id=alert.id,
        title=alert.title,
        description=f"Resolution: {request.resolution_notes}",
        priority=alert.severity,
        status=AlertStatus.RESOLVED,
        resolution_notes=request.resolution_notes,
    )
    db.add(case)
    await db.commit()
    
    return {
        "message": "Alert resolved",
        "status": alert.status.value,
        "case_id": case.id,
    }


@router.get("/summary/counts")
async def get_alert_counts(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get alert counts by status and severity"""
    query = select(Alert)
    
    # RBAC
    if current_user.role == UserRole.FRANCHISEE_OWNER.value:
        query = query.join(Outlet).where(Outlet.franchisee_id == current_user.user_id)
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    # Count by status
    by_status = {}
    for status in AlertStatus:
        by_status[status.value] = sum(1 for a in alerts if a.status == status)
    
    # Count by severity
    by_severity = {}
    for severity in AlertSeverity:
        by_severity[severity.value] = sum(1 for a in alerts if a.severity == severity)
    
    # Count by type
    by_type = {}
    for alert_type in AlertType:
        by_type[alert_type.value] = sum(1 for a in alerts if a.type == alert_type)
    
    return {
        "total": len(alerts),
        "by_status": by_status,
        "by_severity": by_severity,
        "by_type": by_type,
    }
