"""
Notifications API Routes
Handles user notifications and alert subscriptions
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.auth.jwt import TokenData, get_current_user
from common.db.database import get_db
from common.db.models import Alert, AlertSeverity, AlertType, Outlet, User, UserRole

router = APIRouter()


# =============================================================================
# ENUMS
# =============================================================================


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class NotificationPreferences(BaseModel):
    """User notification preferences"""
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = True
    webhook_url: Optional[str] = None
    
    # Alert type subscriptions
    alert_types: list[str] = ["SALES_ANOMALY", "STOCKOUT_RISK", "COMPLAINT"]
    alert_severities: list[str] = ["P0_CRITICAL", "P1_HIGH"]
    
    # Quiet hours
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[str] = None  # "22:00"
    quiet_hours_end: Optional[str] = None    # "08:00"


class NotificationPreferencesResponse(BaseModel):
    """Response for notification preferences"""
    user_id: int
    preferences: NotificationPreferences
    updated_at: datetime


class SendNotificationRequest(BaseModel):
    """Request to send a notification"""
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    channel: NotificationChannel = NotificationChannel.EMAIL
    priority: NotificationPriority = NotificationPriority.NORMAL
    recipients: list[str] = Field(default_factory=list)  # emails or user IDs
    alert_id: Optional[int] = None  # Optional linked alert


class SendNotificationResponse(BaseModel):
    """Response from sending notification"""
    success: bool
    notification_id: str
    channel: str
    recipients_sent: int
    recipients_failed: int
    errors: list[str] = Field(default_factory=list)


class NotificationRecord(BaseModel):
    """Notification record for history"""
    id: int
    title: str
    message: str
    channel: str
    priority: str
    sent_at: datetime
    recipient_count: int
    status: str


class NotificationHistoryResponse(BaseModel):
    """Notification history response"""
    notifications: list[NotificationRecord]
    total: int
    page: int
    per_page: int


class AlertSubscription(BaseModel):
    """Subscription to alerts"""
    outlet_ids: list[int] = Field(default_factory=list, description="Specific outlets (empty = all accessible)")
    alert_types: list[AlertType] = Field(
        default_factory=list,
        description="Alert types to subscribe to"
    )
    alert_severities: list[AlertSeverity] = Field(
        default_factory=list,
        description="Minimum severity level"
    )
    notify_email: bool = True
    notify_sms: bool = False
    notify_push: bool = True


# =============================================================================
# NOTIFICATION ENDPOINTS
# =============================================================================


@router.get(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    summary="Get notification preferences"
)
async def get_preferences(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's notification preferences.
    """
    # For MVP, return default preferences
    # In production, would fetch from user_settings table
    return NotificationPreferencesResponse(
        user_id=current_user.user_id,
        preferences=NotificationPreferences(),
        updated_at=datetime.utcnow()
    )


@router.put(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    summary="Update notification preferences"
)
async def update_preferences(
    preferences: NotificationPreferences,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update notification preferences for current user.
    
    **Note**: This is a stub. In production, would persist to database.
    """
    # Validate webhook URL if provided
    if preferences.webhook_url:
        import re
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
            r'localhost|'  # localhost
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # or IP
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        if not url_pattern.match(preferences.webhook_url):
            raise HTTPException(
                status_code=400,
                detail="Invalid webhook URL format"
            )
    
    # Stub: Return updated preferences (would save to DB)
    return NotificationPreferencesResponse(
        user_id=current_user.user_id,
        preferences=preferences,
        updated_at=datetime.utcnow()
    )


@router.post(
    "/send",
    response_model=SendNotificationResponse,
    summary="Send a notification"
)
async def send_notification(
    request: SendNotificationRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a notification to specified recipients.
    
    **Authorization**: Requires HQ_ADMIN or REGIONAL_MANAGER role.
    
    **Channels**: email, sms, push, webhook
    """
    # RBAC: Only managers can send bulk notifications
    if current_user.role not in [UserRole.HQ_ADMIN.value, UserRole.REGIONAL_MANAGER.value]:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to send notifications"
        )
    
    # Validate alert if provided
    if request.alert_id:
        alert_result = await db.execute(
            select(Alert).where(Alert.id == request.alert_id)
        )
        alert = alert_result.scalar_one_or_none()
        if not alert:
            raise HTTPException(
                status_code=404,
                detail=f"Alert {request.alert_id} not found"
            )
    
    # Stub: Simulate sending notification
    # In production, would integrate with email/SMS/push services
    import uuid
    
    recipients_sent = 0
    recipients_failed = 0
    errors = []
    
    for recipient in request.recipients:
        try:
            # Simulate sending (stub)
            # email: send via SMTP/SES
            # sms: send via Twilio
            # push: send via FCM
            # webhook: POST to URL
            recipients_sent += 1
        except Exception as e:
            recipients_failed += 1
            errors.append(f"Failed to send to {recipient}: {str(e)}")
    
    return SendNotificationResponse(
        success=recipients_failed == 0,
        notification_id=str(uuid.uuid4()),
        channel=request.channel.value,
        recipients_sent=recipients_sent,
        recipients_failed=recipients_failed,
        errors=errors
    )


@router.get(
    "/history",
    response_model=NotificationHistoryResponse,
    summary="Get notification history"
)
async def get_notification_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get notification history for current user.
    
    **Note**: This is a stub that returns empty history.
    In production, would query notification_log table.
    """
    # Stub: Return empty history
    return NotificationHistoryResponse(
        notifications=[],
        total=0,
        page=page,
        per_page=per_page
    )


@router.post(
    "/subscribe",
    summary="Subscribe to alerts"
)
async def subscribe_to_alerts(
    subscription: AlertSubscription,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Subscribe to receive notifications for specific alert types.
    
    **Note**: This is a stub. In production, would create subscription records.
    """
    # Validate outlets if specified
    if subscription.outlet_ids:
        for outlet_id in subscription.outlet_ids:
            result = await db.execute(
                select(Outlet).where(Outlet.id == outlet_id)
            )
            outlet = result.scalar_one_or_none()
            
            if not outlet:
                raise HTTPException(
                    status_code=404,
                    detail=f"Outlet {outlet_id} not found"
                )
            
            # RBAC check
            if current_user.role == UserRole.FRANCHISEE_OWNER.value:
                if outlet.franchisee_id != current_user.user_id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Access denied to outlet {outlet_id}"
                    )
    
    # Stub: Return success
    return {
        "success": True,
        "message": "Alert subscription created",
        "subscription": {
            "outlet_count": len(subscription.outlet_ids),
            "alert_types": [t.value for t in subscription.alert_types],
            "channels": {
                "email": subscription.notify_email,
                "sms": subscription.notify_sms,
                "push": subscription.notify_push
            }
        }
    }


@router.delete(
    "/unsubscribe",
    summary="Unsubscribe from alerts"
)
async def unsubscribe_from_alerts(
    subscription_id: str = Query(..., description="Subscription ID to delete"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Unsubscribe from alerts.
    
    **Note**: This is a stub.
    """
    # Stub: Return success
    return {
        "success": True,
        "message": f"Unsubscribed from {subscription_id}"
    }


@router.get(
    "/channels/test",
    summary="Test notification channels"
)
async def test_notification_channels(
    channel: NotificationChannel = Query(..., description="Channel to test"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a test notification to verify channel configuration.
    
    **Note**: This is a stub.
    """
    # Get user email
    result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()
    
    # Stub: Return test result
    return {
        "success": True,
        "channel": channel.value,
        "recipient": user.email if user else f"user_{current_user.user_id}",
        "message": f"Test notification sent via {channel.value} (stub mode)"
    }
