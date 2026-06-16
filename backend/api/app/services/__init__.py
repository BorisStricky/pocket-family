"""Service layer for the Pocket Family backend.

This package holds DB-interacting and business-logic functions that were
previously defined inline in the routers. The intent of this layer is to keep
the routers thin (request parsing, auth dependencies, response shaping) while
the actual data access and business rules live here.

Conventions for everything in this package:

- Functions are **framework-agnostic**: they take a plain SQLAlchemy
  ``AsyncSession`` as their first parameter (named ``session``) and do NOT use
  FastAPI ``Depends`` or other request-scoped injection. A caller (router,
  background worker, test) can invoke them with any session it already holds.
- Service modules may import from ``..models``, ``..schemas`` and ``..db``.
  They must NOT import from ``..routers`` to avoid import cycles.
- Behavior is identical to the original router-local helpers — this layer was
  introduced as a pure relocation, so any HTTPException, status code, query or
  tenant-filtering logic is preserved verbatim from the original call sites.
"""
