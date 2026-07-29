"""
Initial schema migration
Creates all core tables for CyberQuote

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('HQ_ADMIN', 'REGIONAL_MANAGER', 'FRANCHISEE_OWNER');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE alertstatus AS ENUM ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE alertseverity AS ENUM ('P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE alerttype AS ENUM ('SALES_ANOMALY', 'STOCKOUT_RISK', 'ATTENDANCE_ISSUE', 'COMPLAINT');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE outletstatus AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create regions table
    op.create_table(
        'regions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('region_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=200), nullable=False),
        sa.Column('role', sa.Enum('HQ_ADMIN', 'REGIONAL_MANAGER', 'FRANCHISEE_OWNER', name='userrole', create_type=False), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_role', 'users', ['role'], unique=False)

    # Create outlets table
    op.create_table(
        'outlets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('region_id', sa.Integer(), nullable=False),
        sa.Column('franchisee_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('ACTIVE', 'INACTIVE', 'SUSPENDED', name='outletstatus', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
        sa.ForeignKeyConstraint(['franchisee_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_outlets_region_id', 'outlets', ['region_id'], unique=False)

    # Create sales_transactions table (with transaction_id for idempotency)
    op.create_table(
        'sales_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('transaction_count', sa.Integer(), nullable=False, default=1),
        sa.Column('items', sa.Text(), nullable=True),
        sa.Column('anomaly_score', sa.Float(), nullable=True),
        sa.Column('is_anomaly', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id')
    )
    op.create_index('ix_sales_outlet_date', 'sales_transactions', ['outlet_id', 'date'], unique=False)
    op.create_index('ix_sales_date', 'sales_transactions', ['date'], unique=False)
    op.create_index('ix_sales_transaction_id', 'sales_transactions', ['transaction_id'], unique=True)

    # Create inventory table
    op.create_table(
        'inventory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('product_name', sa.String(length=255), nullable=False),
        sa.Column('current_stock', sa.Integer(), nullable=False, default=0),
        sa.Column('min_stock', sa.Integer(), nullable=False, default=0),
        sa.Column('max_stock', sa.Integer(), nullable=False, default=0),
        sa.Column('unit', sa.String(length=50), nullable=False, default='unit'),
        sa.Column('last_restock_date', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_inventory_outlet_sku', 'inventory', ['outlet_id', 'sku'], unique=False)

    # Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('SALES_ANOMALY', 'STOCKOUT_RISK', 'ATTENDANCE_ISSUE', 'COMPLAINT', name='alerttype', create_type=False), nullable=False),
        sa.Column('severity', sa.Enum('P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW', name='alertseverity', create_type=False), nullable=False),
        sa.Column('status', sa.Enum('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', name='alertstatus', create_type=False), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('triggered_at', sa.DateTime(), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alerts_outlet_id', 'alerts', ['outlet_id'], unique=False)
    op.create_index('ix_alerts_status', 'alerts', ['status'], unique=False)
    op.create_index('ix_alerts_triggered_at', 'alerts', ['triggered_at'], unique=False)

    # Create cases table
    op.create_table(
        'cases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=False),
        sa.Column('assigned_to_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.Enum('P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW', name='alertseverity', create_type=False), nullable=False),
        sa.Column('status', sa.Enum('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', name='alertstatus', create_type=False), nullable=False),
        sa.Column('sla_deadline', sa.DateTime(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cases_alert_id', 'cases', ['alert_id'], unique=False)

    # Create ai_explanations table
    op.create_table(
        'ai_explanations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('model_used', sa.String(length=100), nullable=False),
        sa.Column('context_used', sa.Text(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ai_explanations_user_id', 'ai_explanations', ['user_id'], unique=False)

    # Create ml_model_versions table
    op.create_table(
        'ml_model_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('model_type', sa.String(length=50), nullable=False),
        sa.Column('metrics', sa.Text(), nullable=True),
        sa.Column('is_production', sa.Boolean(), nullable=False, default=False),
        sa.Column('trained_at', sa.DateTime(), nullable=False),
        sa.Column('deployed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ml_versions_name_version', 'ml_model_versions', ['model_name', 'version'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table('ml_model_versions')
    op.drop_table('ai_explanations')
    op.drop_table('cases')
    op.drop_table('alerts')
    op.drop_table('inventory')
    op.drop_table('sales_transactions')
    op.drop_table('outlets')
    op.drop_table('users')
    op.drop_table('regions')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS outletstatus')
    op.execute('DROP TYPE IF EXISTS alerttype')
    op.execute('DROP TYPE IF EXISTS alertseverity')
    op.execute('DROP TYPE IF EXISTS alertstatus')
    op.execute('DROP TYPE IF EXISTS userrole')
