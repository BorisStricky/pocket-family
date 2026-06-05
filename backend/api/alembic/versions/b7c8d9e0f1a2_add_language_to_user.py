"""Add language column to user table

Revision ID: b7c8d9e0f1a2
Revises: f3a4b5c6d7e8
Create Date: 2026-06-05 00:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b7c8d9e0f1a2'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Non-nullable language column with a server_default of "en" so existing
    # rows backfill automatically — no separate data migration is needed.
    op.add_column(
        'user',
        sa.Column('language', sa.String(length=8), nullable=False, server_default='en'),
    )


def downgrade() -> None:
    op.drop_column('user', 'language')
