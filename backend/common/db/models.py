"""
Database models - CyberQuote
Core entities for AI franchise monitoring platform
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Enum as SQLEnum,
    Index,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# =============================================================================
# ENUMS
# =============================================================================


class UserRole(str, Enum):
    HQ_ADMIN = "HQ_ADMIN"
    REGIONAL_MANAGER = "REGIONAL_MANAGER"
    FRANCHISEE_OWNER = "FRANCHISEE_OWNER"


class AlertStatus(str, Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class AlertSeverity(str, Enum):
    P0_CRITICAL = "P0_CRITICAL"
    P1_HIGH = "P1_HIGH"
    P2_MEDIUM = "P2_MEDIUM"
    P3_LOW = "P3_LOW"


class AlertType(str, Enum):
    SALES_ANOMALY = "SALES_ANOMALY"
    STOCKOUT_RISK = "STOCKOUT_RISK"
    ATTENDANCE_ISSUE = "ATTENDANCE_ISSUE"
    COMPLAINT = "COMPLAINT"


class OutletStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


# =============================================================================
# MASTER DATA
# =============================================================================


class Region(Base):
    """Geographic region"""

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    outlets: Mapped[list["Outlet"]] = relationship("Outlet", back_populates="region")
    users: Mapped[list["User"]] = relationship("User", back_populates="region")


class Outlet(Base):
    """Franchise outlet"""

    __tablename__ = "outlets"

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"))
    franchisee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(50), unique=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[OutletStatus] = mapped_column(
        SQLEnum(OutletStatus), default=OutletStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    region: Mapped["Region"] = relationship("Region", back_populates="outlets")
    franchisee: Mapped["User"] = relationship("User", back_populates="owned_outlets")
    sales: Mapped[list["SalesTransaction"]] = relationship(
        "SalesTransaction", back_populates="outlet"
    )
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="outlet")
    inventory: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="outlet")

    __table_args__ = (Index("ix_outlets_region_id", "region_id"),)


class User(Base):
    """System user"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[Optional[int]] = mapped_column(ForeignKey("regions.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # For WhatsApp notifications
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    region: Mapped[Optional["Region"]] = relationship("Region", back_populates="users")
    owned_outlets: Mapped[list["Outlet"]] = relationship("Outlet", back_populates="franchisee")
    cases: Mapped[list["Case"]] = relationship("Case", back_populates="assigned_to_user")
    ai_explanations: Mapped[list["AIExplanation"]] = relationship("AIExplanation", back_populates="user")

    __table_args__ = (Index("ix_users_email", "email"), Index("ix_users_role", "role"))


# =============================================================================
# TRANSACTIONAL DATA
# =============================================================================


class SalesTransaction(Base):
    """Daily sales transaction"""

    __tablename__ = "sales_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # External transaction ID for idempotency (from POS/webhook)
    transaction_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    date: Mapped[datetime] = mapped_column(DateTime)
    amount: Mapped[float] = mapped_column(Float)
    transaction_count: Mapped[int] = mapped_column(Integer, default=1)
    # Items sold (JSON array: [{"sku": "X", "qty": 1, "price": 5000}])
    items: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="sales")

    __table_args__ = (
        Index("ix_sales_outlet_date", "outlet_id", "date"),
        Index("ix_sales_date", "date"),
        Index("ix_sales_transaction_id", "transaction_id"),
    )


class Inventory(Base):
    """Inventory/stock levels"""

    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    sku: Mapped[str] = mapped_column(String(100))
    product_name: Mapped[str] = mapped_column(String(255))
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    max_stock: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(50), default="unit")
    last_restock_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="inventory")

    __table_args__ = (Index("ix_inventory_outlet_sku", "outlet_id", "sku"),)


# =============================================================================
# ALERTING
# =============================================================================


class Alert(Base):
    """Alert generated by ML models"""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    type: Mapped[AlertType] = mapped_column(SQLEnum(AlertType))
    severity: Mapped[AlertSeverity] = mapped_column(SQLEnum(AlertSeverity))
    status: Mapped[AlertStatus] = mapped_column(
        SQLEnum(AlertStatus), default=AlertStatus.NEW
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="alerts")
    cases: Mapped[list["Case"]] = relationship("Case", back_populates="alert", cascade="all, delete-orphan")
    ai_explanations: Mapped[list["AIExplanation"]] = relationship("AIExplanation", back_populates="alert")

    __table_args__ = (
        Index("ix_alerts_outlet_id", "outlet_id"),
        Index("ix_alerts_status", "status"),
        Index("ix_alerts_triggered_at", "triggered_at"),
    )


class Case(Base):
    """Case/work order created from alert"""

    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"))
    assigned_to_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[AlertSeverity] = mapped_column(SQLEnum(AlertSeverity))
    status: Mapped[AlertStatus] = mapped_column(
        SQLEnum(AlertStatus), default=AlertStatus.NEW
    )
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    alert: Mapped["Alert"] = relationship("Alert", back_populates="cases")
    assigned_to_user: Mapped[Optional["User"]] = relationship("User", back_populates="cases")

    __table_args__ = (Index("ix_cases_alert_id", "alert_id"),)


# =============================================================================
# AI / ML
# =============================================================================


class AIExplanation(Base):
    """AI explanation history (audit log)"""

    __tablename__ = "ai_explanations"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[Optional[int]] = mapped_column(ForeignKey("alerts.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    model_used: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")
    context_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    alert: Mapped[Optional["Alert"]] = relationship("Alert", back_populates="ai_explanations")
    user: Mapped["User"] = relationship("User", back_populates="ai_explanations")

    __table_args__ = (Index("ix_ai_explanations_user_id", "user_id"),)


class MLModelVersion(Base):
    """ML model version tracking"""

    __tablename__ = "ml_model_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_name: Mapped[str] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(50))
    model_type: Mapped[str] = mapped_column(String(50))  # anomaly_detection, stockout_prediction
    metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    is_production: Mapped[bool] = mapped_column(Boolean, default=False)
    trained_at: Mapped[datetime] = mapped_column(DateTime)
    deployed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_ml_versions_name_version", "model_name", "version"),)


class MLFeature(Base):
    """Computed ML features for outlet/time periods"""

    __tablename__ = "ml_features"

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    feature_date: Mapped[datetime] = mapped_column(DateTime)
    feature_type: Mapped[str] = mapped_column(String(50))  # sales, inventory
    rolling_avg_7d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rolling_avg_14d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rolling_avg_30d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rolling_std_7d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rolling_std_14d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trend_slope: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    seasonal_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    velocity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ml_features_outlet_date", "outlet_id", "feature_date"),
        Index("ix_ml_features_type", "feature_type"),
    )


class MLScore(Base):
    """ML scoring results for anomaly detection"""

    __tablename__ = "ml_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    model_version_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ml_model_versions.id"), nullable=True
    )
    model_type: Mapped[str] = mapped_column(String(50))
    score: Mapped[float] = mapped_column(Float)  # 0-1 score
    z_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    factors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    avg_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    std_dev: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    percentile: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    data_points: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    scored_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ml_scores_outlet_id", "outlet_id"),
        Index("ix_ml_scores_scored_at", "scored_at"),
        Index("ix_ml_scores_model_type", "model_type"),
    )


class MLPrediction(Base):
    """ML predictions for stockout risk"""

    __tablename__ = "ml_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id"))
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model_version_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ml_model_versions.id"), nullable=True
    )
    risk_score: Mapped[float] = mapped_column(Float)  # 0-1 risk
    days_until_stockout: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recommended_restock: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_velocity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_daily_sales: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trend: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    predicted_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ml_predictions_outlet_id", "outlet_id"),
        Index("ix_ml_predictions_sku", "sku"),
        Index("ix_ml_predictions_predicted_at", "predicted_at"),
        Index("ix_ml_predictions_risk_score", "risk_score"),
    )
