"""Add icon and color columns to account table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-04 00:01:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('account', sa.Column('icon', sa.String(length=64), nullable=True))
    op.add_column('account', sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('account', 'color')
    op.drop_column('account', 'icon')
