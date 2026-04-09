"""Add currency support: RSD, family default currency, exchange rates, transaction originals

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-09 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7a8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Step 1: Extend existing PostgreSQL enum types to include RSD ---
    # The IF NOT EXISTS guard makes this idempotent in case of partial runs.
    # NOTE: ALTER TYPE ... ADD VALUE cannot be rolled back; if the migration
    # is interrupted after this point the enum will contain 'RSD' but the
    # columns won't exist yet. Re-running the migration is safe due to
    # IF NOT EXISTS.
    op.execute(sa.text("ALTER TYPE account_currency ADD VALUE IF NOT EXISTS 'RSD'"))
    op.execute(sa.text("ALTER TYPE transaction_currency ADD VALUE IF NOT EXISTS 'RSD'"))

    # --- Step 2: Add default_currency to tenant ---
    # New families default to BRL; existing families also get BRL since that
    # was the only supported main currency before this migration.
    op.add_column(
        'tenant',
        sa.Column(
            'default_currency',
            postgresql.ENUM('BRL', 'USD', 'EUR', 'RSD', name='account_currency', create_type=False),
            nullable=False,
            server_default='BRL',
        ),
    )

    # --- Step 3: Add original_amount and original_currency to transaction ---
    # Added as nullable first so we can backfill before enforcing NOT NULL.
    op.add_column(
        'transaction',
        sa.Column('original_amount', sa.Numeric(18, 2), nullable=True),
    )
    op.add_column(
        'transaction',
        sa.Column(
            'original_currency',
            postgresql.ENUM('BRL', 'USD', 'EUR', 'RSD', name='transaction_currency', create_type=False),
            nullable=True,
        ),
    )

    # --- Step 4: Backfill existing transactions ---
    # For all pre-existing transactions the original values equal the stored values
    # because no conversion existed before this feature.
    op.execute(sa.text(
        "UPDATE transaction SET original_amount = amount, original_currency = currency"
    ))

    # --- Step 5: Tighten columns to NOT NULL after backfill ---
    op.alter_column('transaction', 'original_amount', nullable=False)
    op.alter_column('transaction', 'original_currency', nullable=False)

    # --- Step 6: Create currencyexchangerate table ---
    # Stores one rate per (family, foreign currency) pair. The unique constraint
    # prevents duplicate rows for the same currency within a family.
    op.create_table(
        'currencyexchangerate',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'tenant_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tenant.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'currency',
            postgresql.ENUM('BRL', 'USD', 'EUR', 'RSD', name='account_currency', create_type=False),
            nullable=False,
        ),
        sa.Column('rate', sa.Numeric(18, 6), nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'currency', name='uq_exchange_rate_tenant_currency'),
    )


def downgrade() -> None:
    # --- Reverse Step 6: Drop exchange rate table ---
    op.drop_table('currencyexchangerate')

    # --- Reverse Steps 3–5: Remove original_* columns from transaction ---
    op.drop_column('transaction', 'original_currency')
    op.drop_column('transaction', 'original_amount')

    # --- Reverse Step 2: Remove default_currency from tenant ---
    op.drop_column('tenant', 'default_currency')

    # NOTE: We do NOT remove 'RSD' from the enum types on downgrade.
    # PostgreSQL does not support removing enum values; doing so would require
    # recreating the type and all columns that reference it, which is risky
    # in production. The enum value simply becomes unused after downgrade.
