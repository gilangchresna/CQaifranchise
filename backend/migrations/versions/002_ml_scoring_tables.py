"""
ML Scoring Tables Migration
Adds ml_scores and ml_predictions tables for storing ML model results

Revision ID: 002_ml_scoring_tables
Revises: 001_initial_schema
Create Date: 2024-01-20 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_ml_scoring_tables'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ml_scores table for storing anomaly detection results
    op.create_table(
        'ml_scores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('model_version_id', sa.Integer(), nullable=True),
        sa.Column('model_type', sa.String(length=50), nullable=False),  # anomaly_detection, stockout_prediction
        sa.Column('score', sa.Float(), nullable=False),  # 0-1 score
        sa.Column('z_score', sa.Float(), nullable=True),  # raw z-score for anomaly
        sa.Column('is_anomaly', sa.Boolean(), nullable=False, default=False),
        sa.Column('confidence', sa.Float(), nullable=True),  # model confidence 0-1
        sa.Column('factors', sa.Text(), nullable=True),  # JSON array of contributing factors
        sa.Column('avg_value', sa.Float(), nullable=True),  # rolling average
        sa.Column('std_dev', sa.Float(), nullable=True),  # rolling std deviation
        sa.Column('percentile', sa.Integer(), nullable=True),  # where current falls in distribution
        sa.Column('data_points', sa.Integer(), nullable=True),  # historical data points used
        sa.Column('scored_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.ForeignKeyConstraint(['model_version_id'], ['ml_model_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ml_scores_outlet_id', 'ml_scores', ['outlet_id'], unique=False)
    op.create_index('ix_ml_scores_scored_at', 'ml_scores', ['scored_at'], unique=False)
    op.create_index('ix_ml_scores_model_type', 'ml_scores', ['model_type'], unique=False)

    # Create ml_predictions table for stockout predictions
    op.create_table(
        'ml_predictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=True),
        sa.Column('model_version_id', sa.Integer(), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=False),  # 0-1 risk score
        sa.Column('days_until_stockout', sa.Integer(), nullable=True),  # predicted days
        sa.Column('recommended_restock', sa.Integer(), nullable=True),  # recommended quantity
        sa.Column('current_velocity', sa.Float(), nullable=True),  # units/day sold
        sa.Column('avg_daily_sales', sa.Float(), nullable=True),  # moving average
        sa.Column('trend', sa.String(length=20), nullable=True),  # increasing, decreasing, stable
        sa.Column('confidence', sa.Float(), nullable=True),  # model confidence
        sa.Column('predicted_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.ForeignKeyConstraint(['model_version_id'], ['ml_model_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ml_predictions_outlet_id', 'ml_predictions', ['outlet_id'], unique=False)
    op.create_index('ix_ml_predictions_sku', 'ml_predictions', ['sku'], unique=False)
    op.create_index('ix_ml_predictions_predicted_at', 'ml_predictions', ['predicted_at'], unique=False)
    op.create_index('ix_ml_predictions_risk_score', 'ml_predictions', ['risk_score'], unique=False)

    # Create ml_features table for storing computed features
    op.create_table(
        'ml_features',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('feature_date', sa.DateTime(), nullable=False),
        sa.Column('feature_type', sa.String(length=50), nullable=False),  # sales, inventory, etc.
        sa.Column('rolling_avg_7d', sa.Float(), nullable=True),  # 7-day rolling average
        sa.Column('rolling_avg_14d', sa.Float(), nullable=True),  # 14-day rolling average
        sa.Column('rolling_avg_30d', sa.Float(), nullable=True),  # 30-day rolling average
        sa.Column('rolling_std_7d', sa.Float(), nullable=True),  # 7-day rolling std
        sa.Column('rolling_std_14d', sa.Float(), nullable=True),  # 14-day rolling std
        sa.Column('trend_slope', sa.Float(), nullable=True),  # linear trend slope
        sa.Column('seasonal_factor', sa.Float(), nullable=True),  # day-of-week factor
        sa.Column('velocity', sa.Float(), nullable=True),  # current velocity (units/time)
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ml_features_outlet_date', 'ml_features', ['outlet_id', 'feature_date'], unique=False)
    op.create_index('ix_ml_features_type', 'ml_features', ['feature_type'], unique=False)

    # Create ml_scheduler_runs table for audit logging
    op.create_table(
        'ml_scheduler_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlets_processed', sa.Integer(), nullable=False, default=0),
        sa.Column('anomalies_detected', sa.Integer(), nullable=False, default=0),
        sa.Column('stockouts_detected', sa.Integer(), nullable=False, default=0),
        sa.Column('alerts_created', sa.Integer(), nullable=False, default=0),
        sa.Column('errors_count', sa.Integer(), nullable=False, default=0),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='running'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('ml_scheduler_runs')
    op.drop_table('ml_features')
    op.drop_table('ml_predictions')
    op.drop_table('ml_scores')
