"""Add icon and color columns to budget table

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-06-04 00:02:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('budget', sa.Column('icon', sa.String(length=64), nullable=True))
    op.add_column('budget', sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('budget', 'color')
    op.drop_column('budget', 'icon')
