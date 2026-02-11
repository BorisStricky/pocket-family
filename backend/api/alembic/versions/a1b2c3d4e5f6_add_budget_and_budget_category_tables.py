"""Add budget and budget_category tables

Revision ID: a1b2c3d4e5f6
Revises: 6b2f8a4f4f4b
Create Date: 2026-02-11 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '6b2f8a4f4f4b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the budget table to hold monthly spending limits per tenant.
    # The currency column reuses the existing 'account_currency' enum type
    # that was already created for the Account model, so create_type=False.
    op.create_table(
        'budget',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'tenant_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tenant.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column(
            'currency',
            postgresql.ENUM('BRL', 'USD', 'EUR', name='account_currency', create_type=False),
            nullable=False,
        ),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create the budget_category join table linking budgets to categories.
    # The unique constraint prevents duplicate (budget, category) pairs.
    # tenant_id is included per north_star invariant: every domain record
    # must have a valid tenant_id for multi-tenant isolation.
    op.create_table(
        'budgetcategory',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'tenant_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tenant.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'budget_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('budget.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'category_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('category.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('added_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('budget_id', 'category_id', name='uq_budget_category_budget_category'),
    )


def downgrade() -> None:
    # Drop join table first to avoid FK constraint issues
    op.drop_table('budgetcategory')
    op.drop_table('budget')
