# Tenant delete

DB-level ondelete="CASCADE" is the right approach - it's atomic, enforced at the DB level, and doesn't require manual ordering. Since Account has no tenant_id FK (accounts belong to users, shared via AccountShare), cascading all tenant FKs is safe.

Replace the current app level cascade with db enforced one and generate a migration

# Leave Family

Family Owners have no option to leave, only be removed. The OIwner should also have the option to leave, as long as he/she is not the last/only owner
