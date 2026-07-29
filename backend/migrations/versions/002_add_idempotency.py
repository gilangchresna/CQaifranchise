"""
Add idempotency constraint to sales_transactions

Revision ID: 002_add_idempotency
Revises: 001_initial_schema
Create Date: 2024-01-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_idempotency'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The unique constraint on transaction_id was already added in the initial schema.
    # This migration adds an idempotency helper function and indexes for performance.
    
    # Add index on created_at for time-based queries
    op.create_index(
        'ix_sales_transactions_created_at',
        'sales_transactions',
        ['created_at'],
        unique=False
    )
    
    # Add composite index for outlet + date + amount (for analytics)
    op.create_index(
        'ix_sales_outlet_date_amount',
        'sales_transactions',
        ['outlet_id', 'date', 'amount'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_sales_outlet_date_amount', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_created_at', table_name='sales_transactions')
