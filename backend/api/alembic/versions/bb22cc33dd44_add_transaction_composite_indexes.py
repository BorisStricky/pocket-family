"""Add composite indexes on transaction for hot read paths

The list/report queries filter by tenant_id and range/order by transaction_date;
per-account views additionally filter by account_id. Single-column indexes cannot
serve these efficiently at scale (Performance P-2).

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-06-10 10:05:00.000000

"""
from alembic import op

revision = 'bb22cc33dd44'
down_revision = 'aa11bb22cc33'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_transaction_tenant_date',
        'transaction',
        ['tenant_id', 'transaction_date'],
    )
    op.create_index(
        'ix_transaction_tenant_account_date',
        'transaction',
        ['tenant_id', 'account_id', 'transaction_date'],
    )


def downgrade() -> None:
    op.drop_index('ix_transaction_tenant_account_date', table_name='transaction')
    op.drop_index('ix_transaction_tenant_date', table_name='transaction')
