"""Add importjob table

Revision ID: c7f9d2e4a1b3
Revises: a1b2c3d4e5f6
Create Date: 2026-05-25 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c7f9d2e4a1b3'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backing enum for the import job status column. Postgres enum labels are
    # the Python enum *names* (uppercase) — matching the SAEnum default used
    # by the ImportJob SQLModel definition.
    import_job_status = postgresql.ENUM(
        'PENDING', 'STARTED', 'DONE', 'FAILED',
        name='import_job_status',
        create_type=True,
    )
    import_job_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'importjob',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'tenant_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tenant.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'account_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('account.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'created_by',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('user.id'),
            nullable=False,
            index=True,
        ),
        sa.Column('file_key', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('imported_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'status',
            postgresql.ENUM(
                'PENDING', 'STARTED', 'DONE', 'FAILED',
                name='import_job_status',
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('celery_task_id', sa.String(), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('importjob')
    sa.Enum(name='import_job_status').drop(op.get_bind(), checkfirst=True)
