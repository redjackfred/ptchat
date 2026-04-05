import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from db.models import Base
from db.session import get_db
from main import app

TEST_DATABASE_URL = "postgresql+asyncpg://ptchat:ptchat@localhost:5432/ptchat_test"


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    engine2 = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine2.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine2.dispose()


@pytest_asyncio.fixture(scope="session")
async def _session_engine():
    """A single engine for the session, shared across all tests."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def _session_db(_session_engine):
    """A session-scoped DB session."""
    factory = async_sessionmaker(_session_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture(scope="session")
async def client(_session_db: AsyncSession):
    """A session-scoped HTTP test client that uses the test DB."""
    async def override_get_db():
        yield _session_db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def db_session(_session_db: AsyncSession):
    """Per-test DB session alias; rolls back after each test via SAVEPOINT."""
    yield _session_db
    # Cancel any background tasks spawned during the test
    await asyncio.sleep(0)
    current = asyncio.current_task()
    tasks = [t for t in asyncio.all_tasks() if t is not current and not t.done()]
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
