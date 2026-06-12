"""Add family_id to refresh token for reuse detection

Adds a token-family grouping column so that replaying an already-rotated
refresh token can revoke the entire chain at once (Security H-2).

Revision ID: aa11bb22cc33
Revises: b7c8d9e0f1a2
Create Date: 2026-06-10 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'aa11bb22cc33'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the column as nullable first so existing rows can be backfilled.
    op.add_column(
        'refreshtoken',
        sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    # Backfill: each existing token becomes its own single-member family. Reusing
    # its own id keeps families distinct without inventing new UUIDs.
    op.execute('UPDATE refreshtoken SET family_id = id WHERE family_id IS NULL')
    # Now enforce NOT NULL and index the column for the family-revocation query.
    op.alter_column('refreshtoken', 'family_id', nullable=False)
    op.create_index('ix_refreshtoken_family_id', 'refreshtoken', ['family_id'])


def downgrade() -> None:
    op.drop_index('ix_refreshtoken_family_id', table_name='refreshtoken')
    op.drop_column('refreshtoken', 'family_id')
