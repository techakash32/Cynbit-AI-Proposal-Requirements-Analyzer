from __future__ import annotations

import httpx
import pytest_asyncio

from app.database.memory import MemoryRepository
from app.main import create_app


@pytest_asyncio.fixture
async def client():
    app = create_app(MemoryRepository())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as value:
        yield value
