"""PostgreSQL connection pool (psycopg3 async)."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ["DATABASE_URL"]

_pool: list = []  # holds a single AsyncConnectionPool instance


async def init_pool() -> None:
    from psycopg_pool import AsyncConnectionPool
    pool = AsyncConnectionPool(DATABASE_URL, min_size=2, max_size=10, open=False)
    await pool.open()
    _pool.append(pool)


async def close_pool() -> None:
    if _pool:
        await _pool[0].close()


@asynccontextmanager
async def get_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    pool = _pool[0]
    async with pool.connection() as conn:
        conn.row_factory = dict_row
        yield conn


async def fetchone(sql: str, params: tuple = ()) -> dict | None:
    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return await cur.fetchone()


async def fetchall(sql: str, params: tuple = ()) -> list[dict]:
    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return await cur.fetchall()


async def execute(sql: str, params: tuple = ()) -> None:
    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)


async def execute_returning(sql: str, params: tuple = ()) -> dict | None:
    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return await cur.fetchone()
