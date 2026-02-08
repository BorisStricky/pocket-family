"""Set tenant foreign keys to ON DELETE CASCADE

Revision ID: 6b2f8a4f4f4b
Revises: 3c1d269eb073
Create Date: 2026-02-06 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '6b2f8a4f4f4b'
down_revision = '3c1d269eb073'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # membership.tenant_id -> tenant.id
    op.drop_constraint('membership_tenant_id_fkey', 'membership', type_='foreignkey')
    op.create_foreign_key(
        'membership_tenant_id_fkey',
        'membership',
        'tenant',
        ['tenant_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # category.tenant_id -> tenant.id
    op.drop_constraint('category_tenant_id_fkey', 'category', type_='foreignkey')
    op.create_foreign_key(
        'category_tenant_id_fkey',
        'category',
        'tenant',
        ['tenant_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # transaction.tenant_id -> tenant.id
    op.drop_constraint('transaction_tenant_id_fkey', 'transaction', type_='foreignkey')
    op.create_foreign_key(
        'transaction_tenant_id_fkey',
        'transaction',
        'tenant',
        ['tenant_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # accountshare.tenant_id -> tenant.id
    op.drop_constraint('accountshare_tenant_id_fkey', 'accountshare', type_='foreignkey')
    op.create_foreign_key(
        'accountshare_tenant_id_fkey',
        'accountshare',
        'tenant',
        ['tenant_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # invite.tenant_id -> tenant.id
    op.drop_constraint('invite_tenant_id_fkey', 'invite', type_='foreignkey')
    op.create_foreign_key(
        'invite_tenant_id_fkey',
        'invite',
        'tenant',
        ['tenant_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('invite_tenant_id_fkey', 'invite', type_='foreignkey')
    op.create_foreign_key('invite_tenant_id_fkey', 'invite', 'tenant', ['tenant_id'], ['id'])

    op.drop_constraint('accountshare_tenant_id_fkey', 'accountshare', type_='foreignkey')
    op.create_foreign_key('accountshare_tenant_id_fkey', 'accountshare', 'tenant', ['tenant_id'], ['id'])

    op.drop_constraint('transaction_tenant_id_fkey', 'transaction', type_='foreignkey')
    op.create_foreign_key('transaction_tenant_id_fkey', 'transaction', 'tenant', ['tenant_id'], ['id'])

    op.drop_constraint('category_tenant_id_fkey', 'category', type_='foreignkey')
    op.create_foreign_key('category_tenant_id_fkey', 'category', 'tenant', ['tenant_id'], ['id'])

    op.drop_constraint('membership_tenant_id_fkey', 'membership', type_='foreignkey')
    op.create_foreign_key('membership_tenant_id_fkey', 'membership', 'tenant', ['tenant_id'], ['id'])
