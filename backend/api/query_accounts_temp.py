"""
Temporary script to query accounts for test tenant.
This script will be deleted after use.
"""
import asyncio
from sqlalchemy import text
from app.db import get_engine

async def query_accounts():
    """Query accounts for the test tenant"""
    engine = get_engine()
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT id, name, account_type, balance
                FROM accounts
                WHERE tenant_id = 'a7f5df79-b643-460a-9751-df67f4de7800'
                ORDER BY created_at
            """)
        )
        rows = result.fetchall()
        print('Account ID | Name | Type | Balance')
        print('-' * 80)
        for row in rows:
            print(f'{row[0]} | {row[1]} | {row[2]} | {row[3]}')

if __name__ == '__main__':
    asyncio.run(query_accounts())
