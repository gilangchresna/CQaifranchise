"""
Webhook Ingestion API Routes
Handles POS/sales data ingestion from external systems with HMAC-SHA256 validation
"""
import hashlib
import hmac
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.config import get_settings
from common.db.database import get_db
from common.db.models import Outlet, SalesTransaction

router = APIRouter()
settings = get_settings()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================


class WebhookItem(BaseModel):
    """Individual item in a transaction"""
    sku: str = Field(..., description="Product SKU")
    name: Optional[str] = Field(None, description="Product name")
    quantity: int = Field(default=1, ge=1, description="Quantity sold")
    unit_price: float = Field(..., ge=0, description="Unit price")
    subtotal: Optional[float] = Field(None, description="Line subtotal")


class WebhookPayload(BaseModel):
    """Webhook payload from POS system"""
    outlet_id: int = Field(..., description="Outlet ID in our system")
    transaction_id: str = Field(..., min_length=1, max_length=100, description="External transaction ID for idempotency")
    amount: float = Field(..., ge=0, description="Total transaction amount")
    items: list[WebhookItem] = Field(default_factory=list, description="Items sold")
    timestamp: datetime = Field(..., description="Transaction timestamp")
    currency: str = Field(default="IDR", description="Currency code")

    @field_validator('transaction_id')
    @classmethod
    def validate_transaction_id(cls, v: str) -> str:
        """Normalize transaction ID - strip whitespace"""
        return v.strip()


class WebhookResponse(BaseModel):
    """Response from webhook processing"""
    status: str
    message: str
    transaction_id: Optional[int] = None
    is_duplicate: bool = False


# =============================================================================
# HMAC VALIDATION
# =============================================================================


def verify_hmac_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify HMAC-SHA256 signature from webhook header.
    
    Header format: X-Signature-256: sha256=<hex_digest>
    """
    if not signature:
        return False
    
    # Extract the hex digest from "sha256=<hex>" format
    if signature.startswith("sha256="):
        received_digest = signature[7:]
    else:
        received_digest = signature
    
    # Calculate expected digest
    expected_digest = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(received_digest.lower(), expected_digest.lower())


async def validate_webhook_signature(
    request: Request,
    x_signature_256: str = Header(..., description="HMAC-SHA256 signature"),
) -> bytes:
    """
    Dependency to validate webhook HMAC signature.
    Raises 401 if signature is invalid.
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify signature
    if not verify_hmac_signature(body, x_signature_256, settings.webhook.hmac_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )
    
    return body


# =============================================================================
# WEBHOOK ENDPOINTS
# =============================================================================


@router.post(
    "/webhook",
    response_model=WebhookResponse,
    summary="Ingest sales transaction from POS",
    description="""
    Receive sales data from external POS systems.
    
    **Security**: Requires valid HMAC-SHA256 signature in X-Signature-256 header.
    
    **Idempotency**: Uses transaction_id for deduplication. Duplicate requests return 200.
    
    **Example signature calculation**:
    ```python
    import hashlib, hmac, json
    payload = json.dumps(data).encode()
    signature = 'sha256=' + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    ```
    """,
    responses={
        200: {"description": "Transaction processed or duplicate acknowledged"},
        401: {"description": "Invalid or missing signature"},
        404: {"description": "Outlet not found"},
        422: {"description": "Validation error"},
    }
)
async def ingest_webhook(
    payload: WebhookPayload,
    body: bytes = Depends(validate_webhook_signature),
    db: AsyncSession = Depends(get_db),
) -> WebhookResponse:
    """
    Ingest sales transaction from webhook.
    
    - Validates HMAC signature
    - Checks for duplicate transaction_id
    - Creates SalesTransaction record
    """
    # Check for existing transaction (idempotency)
    existing = await db.execute(
        select(SalesTransaction).where(
            SalesTransaction.transaction_id == payload.transaction_id
        )
    )
    existing_tx = existing.scalar_one_or_none()
    
    if existing_tx:
        return WebhookResponse(
            status="ok",
            message="Transaction already exists",
            transaction_id=existing_tx.id,
            is_duplicate=True
        )
    
    # Validate outlet exists
    outlet_result = await db.execute(
        select(Outlet).where(Outlet.id == payload.outlet_id)
    )
    outlet = outlet_result.scalar_one_or_none()
    
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outlet with id {payload.outlet_id} not found"
        )
    
    # Serialize items to JSON
    items_json = None
    if payload.items:
        items_data = [
            {
                "sku": item.sku,
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": item.subtotal or (item.quantity * item.unit_price)
            }
            for item in payload.items
        ]
        items_json = json.dumps(items_data)
    
    # Calculate transaction count from items, default to 1
    transaction_count = len(payload.items) if payload.items else 1
    
    # Create transaction record
    transaction = SalesTransaction(
        transaction_id=payload.transaction_id,
        outlet_id=payload.outlet_id,
        date=payload.timestamp,
        amount=payload.amount,
        transaction_count=transaction_count,
        items=items_json,
        # Note: anomaly_score and is_anomaly would be set by ML pipeline
        # For now, we'll leave them as defaults
    )
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    
    return WebhookResponse(
        status="created",
        message="Transaction ingested successfully",
        transaction_id=transaction.id,
        is_duplicate=False
    )


@router.get(
    "/health",
    summary="Webhook endpoint health check",
    tags=["internal"]
)
async def webhook_health():
    """Health check for webhook endpoint (no auth required)"""
    return {"status": "healthy", "endpoint": "webhook"}
