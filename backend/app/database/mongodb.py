"""MongoDB connection via Motor (async driver)."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from ..core.config import get_settings

_client: AsyncIOMotorClient | None = None


def connect_db() -> AsyncIOMotorDatabase:
    global _client
    s = get_settings()
    _client = AsyncIOMotorClient(s.MONGODB_URI, uuidRepresentation="standard")
    return _client[s.MONGODB_DATABASE]


def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency — the client is created during app startup."""
    if _client is None:
        connect_db()
    assert _client is not None
    return _client[get_settings().MONGODB_DATABASE]
