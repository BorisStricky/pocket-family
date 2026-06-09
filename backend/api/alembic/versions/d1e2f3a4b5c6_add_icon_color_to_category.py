"""Add icon and color columns to category table

Revision ID: d1e2f3a4b5c6
Revises: c7f9d2e4a1b3
Create Date: 2026-06-04 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd1e2f3a4b5c6'
down_revision = 'c7f9d2e4a1b3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('category', sa.Column('icon', sa.String(length=64), nullable=True))
    op.add_column('category', sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('category', 'color')
    op.drop_column('category', 'icon')
