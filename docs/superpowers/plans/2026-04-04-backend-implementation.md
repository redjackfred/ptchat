# PTChat Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular FastAPI backend with PostgreSQL+pgvector, multi-LLM provider abstraction, RagAnything RAG pipeline, document management, and SSE chat streaming.

**Architecture:** Modular monolith — each domain (llm, rag, chat, documents, settings) has its own router/service/schema. Modules talk through service interfaces, never cross-domain DB queries. LLM providers implement a shared ABC so new ones can be added without touching existing code.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.x (async), Alembic, PostgreSQL 16 + pgvector, RagAnything, watchdog, keyring, pytest + pytest-asyncio + httpx

---

## File Map

```
ptchat/
├── docker-compose.yml
├── backend/
│   ├── main.py                          # FastAPI app factory, router registration
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_initial.py
│   ├── core/
│   │   └── config.py                    # Settings from .env (DB URL, uploads dir)
│   ├── db/
│   │   ├── models.py                    # SQLAlchemy ORM models
│   │   └── session.py                   # Async engine + get_db dependency
│   ├── llm/
│   │   ├── base.py                      # LLMProvider ABC + Message dataclass
│   │   ├── registry.py                  # Provider registry (name → instance)
│   │   └── providers/
│   │       ├── __init__.py
│   │       ├── openai.py
│   │       ├── anthropic.py
│   │       ├── google.py
│   │       └── ollama.py
│   ├── rag/
│   │   ├── pipeline.py                  # RagAnything ingest wrapper
│   │   └── retriever.py                 # pgvector hybrid search
│   ├── chat/
│   │   ├── router.py                    # /sessions + /sessions/{id}/messages + /stream
│   │   ├── service.py                   # Session/message CRUD
│   │   └── schemas.py                   # Pydantic models
│   ├── documents/
│   │   ├── router.py                    # /documents upload + list + delete
│   │   ├── service.py                   # Ingest + DB metadata
│   │   ├── watcher.py                   # watchdog folder monitor
│   │   └── schemas.py
│   ├── settings/
│   │   ├── router.py                    # /settings GET + PATCH
│   │   └── service.py                   # keyring + JSON config read/write
│   └── tests/
│       ├── conftest.py                  # Async test DB + FastAPI client
│       ├── test_llm_registry.py
│       ├── test_settings.py
│       ├── test_documents_api.py
│       └── test_chat_api.py
```

---

## Task 1: Docker Compose + Project Skeleton

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/requirements.txt`
- Create: `backend/core/config.py`
- Create: `backend/main.py`
- Create: `backend/.env.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ptchat
      POSTGRES_PASSWORD: ptchat
      POSTGRES_DB: ptchat
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.13.3
pgvector==0.3.5
pydantic-settings==2.5.2
python-multipart==0.0.12
keyring==25.4.1
watchdog==5.0.3
raganything==0.1.0
openai==1.51.0
anthropic==0.36.2
google-generativeai==0.8.3
httpx==0.27.2
sse-starlette==2.1.3
pytest==8.3.3
pytest-asyncio==0.24.0
aiofiles==24.1.0
```

> **Note:** Verify the exact `raganything` package name and version from https://github.com/HKUDS/RagAnything before installing. The package may be installed directly from GitHub: `raganything @ git+https://github.com/HKUDS/RagAnything.git`

- [ ] **Step 3: Create `backend/.env.example`**

```
DATABASE_URL=postgresql+asyncpg://ptchat:ptchat@localhost:5432/ptchat
UPLOADS_DIR=./uploads
SETTINGS_FILE=~/.ptchat/settings.json
```

Copy to `backend/.env` and fill in values.

- [ ] **Step 4: Create `backend/core/config.py`**

```python
from pydantic_settings import BaseSettings
from pathlib import Path


class Config(BaseSettings):
    database_url: str
    uploads_dir: Path = Path("./uploads")
    settings_file: Path = Path("~/.ptchat/settings.json")

    model_config = {"env_file": ".env"}


config = Config()
```

- [ ] **Step 5: Create `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PTChat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Start the DB and verify it runs**

```bash
docker compose up -d
docker compose ps
# Expected: db container running, port 5432 open
```

- [ ] **Step 7: Install dependencies and start the server**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://localhost:8000/health — expected: `{"status": "ok"}`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml backend/
git commit -m "feat: project skeleton — FastAPI + Docker Compose + config"
```

---

## Task 2: Database Models + Migrations

**Files:**
- Create: `backend/db/models.py`
- Create: `backend/db/session.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_initial.py`

- [ ] **Step 1: Create `backend/db/models.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, BigInteger, DateTime, ForeignKey, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    llm_provider: Mapped[str] = mapped_column(String(64), nullable=False)
    llm_model: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    session: Mapped["Session"] = relationship(back_populates="messages")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(
            "status IN ('processing', 'ready', 'failed')", name="ck_status"
        ),
        CheckConstraint("source IN ('upload', 'folder')", name="ck_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="processing")
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
```

- [ ] **Step 2: Create `backend/db/session.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import config

engine = create_async_engine(config.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 3: Initialise Alembic**

```bash
cd backend
alembic init alembic
```

- [ ] **Step 4: Edit `backend/alembic/env.py`** — replace the `run_migrations_online` block with async support

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from db.models import Base
from core.config import config as app_config

alembic_config = context.config
fileConfig(alembic_config.config_file_name)
target_metadata = Base.metadata
alembic_config.set_main_option("sqlalchemy.url", app_config.database_url)


def run_migrations_offline():
    context.configure(
        url=app_config.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        alembic_config.get_section(alembic_config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5: Create `backend/alembic/versions/0001_initial.py`**

```python
"""initial

Revision ID: 0001
Revises:
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("llm_provider", sa.String(64), nullable=False),
        sa.Column("llm_model", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True),
                  sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_role"),
    )

    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("file_type", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger),
        sa.Column("status", sa.String(16), nullable=False, server_default="processing"),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("file_path", sa.Text),
        sa.Column("indexed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('processing', 'ready', 'failed')", name="ck_status"
        ),
        sa.CheckConstraint("source IN ('upload', 'folder')", name="ck_source"),
    )


def downgrade():
    op.drop_table("documents")
    op.drop_table("messages")
    op.drop_table("sessions")
```

- [ ] **Step 6: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade  -> 0001, initial`

- [ ] **Step 7: Verify tables exist**

```bash
docker exec -it $(docker compose ps -q db) psql -U ptchat -d ptchat -c "\dt"
```

Expected: `sessions`, `messages`, `documents` tables listed.

- [ ] **Step 8: Commit**

```bash
git add backend/db/ backend/alembic/ backend/alembic.ini
git commit -m "feat: DB models and initial Alembic migration"
```

---

## Task 3: Test Infrastructure

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create `backend/tests/conftest.py`**

```python
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from db.models import Base
from db.session import get_db
from main import app

TEST_DATABASE_URL = "postgresql+asyncpg://ptchat:ptchat@localhost:5432/ptchat_test"

test_engine = create_async_engine(TEST_DATABASE_URL)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Create the test database**

```bash
docker exec -it $(docker compose ps -q db) psql -U ptchat -c "CREATE DATABASE ptchat_test;"
docker exec -it $(docker compose ps -q db) psql -U ptchat -d ptchat_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 4: Verify test setup works**

```bash
cd backend
pytest tests/ -v
```

Expected: `no tests ran` (0 tests, no errors)

- [ ] **Step 5: Commit**

```bash
git add backend/tests/ backend/pytest.ini
git commit -m "feat: test infrastructure with async test DB"
```

---

## Task 4: LLM Provider Abstraction + Registry

**Files:**
- Create: `backend/llm/base.py`
- Create: `backend/llm/registry.py`
- Create: `backend/llm/providers/__init__.py`
- Create: `backend/tests/test_llm_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_llm_registry.py
import pytest
from llm.registry import registry
from llm.base import LLMProvider


def test_registry_has_all_builtin_providers():
    names = registry.list_providers()
    assert "openai" in names
    assert "anthropic" in names
    assert "google" in names
    assert "ollama" in names


def test_get_provider_returns_llmprovider_instance():
    provider = registry.get("ollama")  # Ollama needs no API key
    assert isinstance(provider, LLMProvider)


def test_get_unknown_provider_raises():
    with pytest.raises(KeyError):
        registry.get("nonexistent")


def test_provider_has_required_methods():
    provider = registry.get("ollama")
    assert hasattr(provider, "chat")
    assert hasattr(provider, "supports_vision")
    assert hasattr(provider, "available_models")
    assert callable(provider.supports_vision)
    assert isinstance(provider.available_models(), list)
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_llm_registry.py -v
```

Expected: `ModuleNotFoundError: No module named 'llm'`

- [ ] **Step 3: Create `backend/llm/base.py`**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str


class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        """Yield token strings. If stream=False, yield a single complete string."""
        ...

    @abstractmethod
    def supports_vision(self) -> bool:
        """Returns True if this provider can handle image inputs."""
        ...

    @abstractmethod
    def available_models(self) -> list[str]:
        """Returns the list of model IDs available for this provider."""
        ...
```

- [ ] **Step 4: Create `backend/llm/providers/__init__.py`** (empty)

```python
```

- [ ] **Step 5: Create `backend/llm/providers/ollama.py`** (stub — full implementation in Task 8)

```python
import httpx
from llm.base import LLMProvider, Message
from typing import AsyncIterator


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    def supports_vision(self) -> bool:
        return False

    def available_models(self) -> list[str]:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=2)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return []

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        # Implemented in Task 8
        yield ""
```

- [ ] **Step 6: Create `backend/llm/registry.py`**

```python
from llm.base import LLMProvider
from llm.providers.ollama import OllamaProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, LLMProvider] = {}

    def register(self, name: str, provider: LLMProvider) -> None:
        self._providers[name] = provider

    def get(self, name: str) -> LLMProvider:
        if name not in self._providers:
            raise KeyError(f"Unknown provider: {name!r}")
        return self._providers[name]

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())


registry = ProviderRegistry()

# Register built-in providers (API-key providers added with empty keys for now)
registry.register("ollama", OllamaProvider())

# These will be fully registered after settings module is ready (Task 9)
# Stubs added here so the registry tests pass
from llm.providers.openai import OpenAIProvider
from llm.providers.anthropic import AnthropicProvider
from llm.providers.google import GoogleProvider

registry.register("openai", OpenAIProvider(api_key=""))
registry.register("anthropic", AnthropicProvider(api_key=""))
registry.register("google", GoogleProvider(api_key=""))
```

- [ ] **Step 7: Create stub providers for openai, anthropic, google**

```python
# backend/llm/providers/openai.py
from llm.base import LLMProvider, Message
from typing import AsyncIterator


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        yield ""  # Implemented in Task 5
```

```python
# backend/llm/providers/anthropic.py
from llm.base import LLMProvider, Message
from typing import AsyncIterator


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        yield ""  # Implemented in Task 6
```

```python
# backend/llm/providers/google.py
from llm.base import LLMProvider, Message
from typing import AsyncIterator


class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        yield ""  # Implemented in Task 7
```

- [ ] **Step 8: Run tests — expect pass**

```bash
pytest tests/test_llm_registry.py -v
```

Expected: 4 passed

- [ ] **Step 9: Commit**

```bash
git add backend/llm/
git commit -m "feat: LLM provider ABC and registry with stub providers"
```

---

## Task 5: Settings Module

**Files:**
- Create: `backend/settings/service.py`
- Create: `backend/settings/router.py`
- Create: `backend/tests/test_settings.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_settings.py
import pytest
from settings.service import SettingsService


def test_get_settings_returns_defaults():
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    s = svc.get()
    assert s["theme"] == "system"
    assert s["ollama_endpoint"] == "http://localhost:11434"
    assert s["watched_folders"] == []


def test_update_theme():
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    svc.update({"theme": "dark"})
    assert svc.get()["theme"] == "dark"
    # reset
    svc.update({"theme": "system"})


def test_set_and_get_api_key(monkeypatch):
    """keyring stores and retrieves without touching disk."""
    stored = {}

    def fake_set(service, username, password):
        stored[(service, username)] = password

    def fake_get(service, username):
        return stored.get((service, username))

    monkeypatch.setattr("keyring.set_password", fake_set)
    monkeypatch.setattr("keyring.get_password", fake_get)

    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    svc.set_api_key("openai", "sk-test-key")
    assert svc.get_api_key("openai") == "sk-test-key"


def test_missing_api_key_returns_none(monkeypatch):
    monkeypatch.setattr("keyring.get_password", lambda s, u: None)
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    assert svc.get_api_key("openai") is None
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_settings.py -v
```

Expected: `ModuleNotFoundError: No module named 'settings'`

- [ ] **Step 3: Create `backend/settings/service.py`**

```python
import json
import keyring
from pathlib import Path

KEYRING_SERVICE = "ptchat"
DEFAULTS = {
    "theme": "system",
    "ollama_endpoint": "http://localhost:11434",
    "watched_folders": [],
}


class SettingsService:
    def __init__(self, settings_file: str | None = None):
        from core.config import config
        self._path = Path(settings_file or config.settings_file).expanduser()

    def _load(self) -> dict:
        if self._path.exists():
            return json.loads(self._path.read_text())
        return {}

    def _save(self, data: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, indent=2))

    def get(self) -> dict:
        data = self._load()
        return {**DEFAULTS, **data}

    def update(self, patch: dict) -> dict:
        data = self._load()
        data.update(patch)
        self._save(data)
        return {**DEFAULTS, **data}

    def set_api_key(self, provider: str, key: str) -> None:
        keyring.set_password(KEYRING_SERVICE, provider, key)

    def get_api_key(self, provider: str) -> str | None:
        return keyring.get_password(KEYRING_SERVICE, provider)

    def delete_api_key(self, provider: str) -> None:
        try:
            keyring.delete_password(KEYRING_SERVICE, provider)
        except keyring.errors.PasswordDeleteError:
            pass
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/test_settings.py -v
```

Expected: 4 passed

- [ ] **Step 5: Create `backend/settings/router.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel
from settings.service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])
_svc = SettingsService()


class SettingsPatch(BaseModel):
    theme: str | None = None
    ollama_endpoint: str | None = None
    watched_folders: list[str] | None = None


class ApiKeyBody(BaseModel):
    key: str


@router.get("")
def get_settings():
    return _svc.get()


@router.patch("")
def update_settings(patch: SettingsPatch):
    return _svc.update(patch.model_dump(exclude_none=True))


@router.get("/providers")
def list_providers():
    """Returns all providers with whether their API key is configured."""
    from llm.registry import registry
    providers = []
    for name in registry.list_providers():
        p = registry.get(name)
        has_key = name == "ollama" or bool(_svc.get_api_key(name))
        providers.append({
            "name": name,
            "models": p.available_models(),
            "supports_vision": p.supports_vision(),
            "has_key": has_key,
        })
    return providers


@router.put("/api-keys/{provider}")
def set_api_key(provider: str, body: ApiKeyBody):
    _svc.set_api_key(provider, body.key)
    return {"ok": True}


@router.delete("/api-keys/{provider}")
def delete_api_key(provider: str):
    _svc.delete_api_key(provider)
    return {"ok": True}
```

- [ ] **Step 6: Register router in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from settings.router import router as settings_router

app = FastAPI(title="PTChat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Verify endpoint works**

```bash
uvicorn main:app --reload &
curl http://localhost:8000/settings
```

Expected: `{"theme":"system","ollama_endpoint":"http://localhost:11434","watched_folders":[]}`

- [ ] **Step 8: Commit**

```bash
git add backend/settings/ backend/main.py
git commit -m "feat: settings module — keyring API keys + JSON config"
```

---

## Task 6: OpenAI Provider (Full Implementation)

**Files:**
- Modify: `backend/llm/providers/openai.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_llm_registry.py  — add this test
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from llm.providers.openai import OpenAIProvider
from llm.base import Message


@pytest.mark.asyncio
async def test_openai_chat_streams_tokens():
    provider = OpenAIProvider(api_key="sk-fake")

    fake_chunk = MagicMock()
    fake_chunk.choices = [MagicMock()]
    fake_chunk.choices[0].delta.content = "Hello"

    async def fake_stream():
        yield fake_chunk

    with patch("openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat.completions.create = AsyncMock(return_value=fake_stream())

        tokens = []
        async for token in provider.chat(
            [Message(role="user", content="hi")], model="gpt-4o"
        ):
            tokens.append(token)

    assert "Hello" in tokens
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_llm_registry.py::test_openai_chat_streams_tokens -v
```

Expected: FAIL — yields empty string from stub

- [ ] **Step 3: Implement `backend/llm/providers/openai.py`**

```python
from typing import AsyncIterator
import openai
from llm.base import LLMProvider, Message


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _client(self):
        return openai.AsyncOpenAI(api_key=self.api_key)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        client = self._client()
        oai_messages = [{"role": m.role, "content": m.content} for m in messages]
        if stream:
            async with client.chat.completions.stream(
                model=model, messages=oai_messages
            ) as s:
                async for chunk in s:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
        else:
            resp = await client.chat.completions.create(
                model=model, messages=oai_messages
            )
            yield resp.choices[0].message.content
```

- [ ] **Step 4: Run test — expect pass**

```bash
pytest tests/test_llm_registry.py::test_openai_chat_streams_tokens -v
```

Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/llm/providers/openai.py
git commit -m "feat: OpenAI provider with streaming"
```

---

## Task 7: Anthropic Provider (Full Implementation)

**Files:**
- Modify: `backend/llm/providers/anthropic.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to backend/tests/test_llm_registry.py
from llm.providers.anthropic import AnthropicProvider


@pytest.mark.asyncio
async def test_anthropic_chat_streams_tokens():
    provider = AnthropicProvider(api_key="fake-key")

    fake_event = MagicMock()
    fake_event.type = "content_block_delta"
    fake_event.delta = MagicMock()
    fake_event.delta.text = "World"

    async def fake_stream():
        yield fake_event

    with patch("anthropic.AsyncAnthropic") as MockClient:
        instance = MockClient.return_value
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=fake_stream())
        cm.__aexit__ = AsyncMock(return_value=False)
        instance.messages.stream.return_value = cm

        tokens = []
        async for token in provider.chat(
            [Message(role="user", content="hi")], model="claude-sonnet-4-6"
        ):
            tokens.append(token)

    assert "World" in tokens
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_llm_registry.py::test_anthropic_chat_streams_tokens -v
```

Expected: FAIL

- [ ] **Step 3: Implement `backend/llm/providers/anthropic.py`**

```python
from typing import AsyncIterator
import anthropic
from llm.base import LLMProvider, Message


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _client(self):
        return anthropic.AsyncAnthropic(api_key=self.api_key)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        client = self._client()
        # Anthropic separates system messages
        system = next(
            (m.content for m in messages if m.role == "system"), None
        )
        user_messages = [
            {"role": m.role, "content": m.content}
            for m in messages if m.role != "system"
        ]
        kwargs = dict(model=model, max_tokens=4096, messages=user_messages)
        if system:
            kwargs["system"] = system

        if stream:
            async with client.messages.stream(**kwargs) as s:
                async for event in s:
                    if (
                        event.type == "content_block_delta"
                        and hasattr(event.delta, "text")
                    ):
                        yield event.delta.text
        else:
            resp = await client.messages.create(**kwargs)
            yield resp.content[0].text
```

- [ ] **Step 4: Run test — expect pass**

```bash
pytest tests/test_llm_registry.py::test_anthropic_chat_streams_tokens -v
```

Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/llm/providers/anthropic.py
git commit -m "feat: Anthropic provider with streaming"
```

---

## Task 8: Google Gemini + Ollama Providers (Full Implementation)

**Files:**
- Modify: `backend/llm/providers/google.py`
- Modify: `backend/llm/providers/ollama.py`

- [ ] **Step 1: Implement `backend/llm/providers/google.py`**

```python
from typing import AsyncIterator
import google.generativeai as genai
from llm.base import LLMProvider, Message


class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _model(self, model_id: str):
        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel(model_id)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        gemini_model = self._model(model)
        # Convert to Gemini history format
        history = []
        prompt = ""
        for m in messages:
            if m.role == "system":
                history.append({"role": "user", "parts": [m.content]})
                history.append({"role": "model", "parts": ["Understood."]})
            elif m.role == "user":
                prompt = m.content
            elif m.role == "assistant":
                history.append({"role": "model", "parts": [m.content]})

        chat = gemini_model.start_chat(history=history)
        if stream:
            response = await chat.send_message_async(prompt, stream=True)
            async for chunk in response:
                yield chunk.text
        else:
            response = await chat.send_message_async(prompt)
            yield response.text
```

- [ ] **Step 2: Implement `backend/llm/providers/ollama.py`**

```python
from typing import AsyncIterator
import httpx
from llm.base import LLMProvider, Message


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    def supports_vision(self) -> bool:
        return False

    def available_models(self) -> list[str]:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=2)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return []

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
        }
        async with httpx.AsyncClient() as client:
            if stream:
                async with client.stream(
                    "POST", f"{self.base_url}/api/chat", json=payload, timeout=60
                ) as resp:
                    import json
                    async for line in resp.aiter_lines():
                        if line:
                            data = json.loads(line)
                            if content := data.get("message", {}).get("content"):
                                yield content
            else:
                resp = await client.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=60
                )
                yield resp.json()["message"]["content"]
```

- [ ] **Step 3: Update the registry to read API keys from settings at startup**

Replace the bottom of `backend/llm/registry.py`:

```python
from llm.base import LLMProvider
from llm.providers.ollama import OllamaProvider
from llm.providers.openai import OpenAIProvider
from llm.providers.anthropic import AnthropicProvider
from llm.providers.google import GoogleProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, LLMProvider] = {}

    def register(self, name: str, provider: LLMProvider) -> None:
        self._providers[name] = provider

    def get(self, name: str) -> LLMProvider:
        if name not in self._providers:
            raise KeyError(f"Unknown provider: {name!r}")
        return self._providers[name]

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())

    def reload_keys(self) -> None:
        """Re-read API keys from keyring and reinitialise providers."""
        from settings.service import SettingsService
        svc = SettingsService()
        settings = svc.get()
        ollama_url = settings.get("ollama_endpoint", "http://localhost:11434")
        self._providers["ollama"] = OllamaProvider(base_url=ollama_url)
        self._providers["openai"] = OpenAIProvider(
            api_key=svc.get_api_key("openai") or ""
        )
        self._providers["anthropic"] = AnthropicProvider(
            api_key=svc.get_api_key("anthropic") or ""
        )
        self._providers["google"] = GoogleProvider(
            api_key=svc.get_api_key("google") or ""
        )


registry = ProviderRegistry()
registry.reload_keys()
```

- [ ] **Step 4: Add startup event to reload keys in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from settings.router import router as settings_router
from llm.registry import registry


@asynccontextmanager
async def lifespan(app):
    registry.reload_keys()
    yield


app = FastAPI(title="PTChat API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run all LLM tests**

```bash
pytest tests/test_llm_registry.py -v
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add backend/llm/
git commit -m "feat: Google and Ollama providers, registry key reload on startup"
```

---

## Task 9: RAG Pipeline

**Files:**
- Create: `backend/rag/pipeline.py`
- Create: `backend/rag/retriever.py`

> **Important:** Before this task, read the RagAnything documentation at https://github.com/HKUDS/RagAnything to confirm the exact API. The code below follows common RagAnything patterns — adjust method names/parameters as needed.

- [ ] **Step 1: Create `backend/rag/pipeline.py`**

```python
import asyncio
from pathlib import Path
from raganything import RagAnything
from core.config import config

# Singleton RAG instance
_rag: RagAnything | None = None


def get_rag() -> RagAnything:
    global _rag
    if _rag is None:
        _rag = RagAnything(
            working_dir=str(config.uploads_dir / ".rag_index"),
        )
    return _rag


async def ingest_file(file_path: str | Path) -> None:
    """Process and index a single file into the RAG store."""
    rag = get_rag()
    await asyncio.to_thread(rag.insert_file, str(file_path))


async def delete_file(file_path: str | Path) -> None:
    """Remove a file's chunks from the RAG store."""
    rag = get_rag()
    await asyncio.to_thread(rag.delete_by_source, str(file_path))


async def query(text: str, top_k: int = 5) -> str:
    """
    Retrieve relevant context for a query.
    Returns a formatted string of retrieved chunks to inject as RAG context.
    """
    rag = get_rag()
    results = await asyncio.to_thread(rag.query, text, top_k=top_k)
    if not results:
        return ""
    chunks = [r.get("content", "") for r in results if r.get("content")]
    return "\n\n---\n\n".join(chunks)
```

- [ ] **Step 2: Create `backend/rag/retriever.py`**

```python
from rag.pipeline import query as rag_query
from llm.base import Message


async def build_rag_context(user_message: str) -> str:
    """Query the RAG store and return a system message with context."""
    context = await rag_query(user_message)
    if not context:
        return ""
    return (
        "Use the following retrieved context to answer the user's question. "
        "If the context is not relevant, answer from your own knowledge.\n\n"
        f"<context>\n{context}\n</context>"
    )


async def augment_messages(messages: list[Message]) -> list[Message]:
    """
    Prepend a RAG context system message to the conversation.
    Uses the last user message as the query.
    """
    last_user = next(
        (m.content for m in reversed(messages) if m.role == "user"), None
    )
    if not last_user:
        return messages

    context_msg = await build_rag_context(last_user)
    if not context_msg:
        return messages

    # Replace or prepend system message with RAG context
    non_system = [m for m in messages if m.role != "system"]
    return [Message(role="system", content=context_msg)] + non_system
```

- [ ] **Step 3: Make sure uploads dir exists at startup — add to `backend/main.py` lifespan**

```python
@asynccontextmanager
async def lifespan(app):
    from core.config import config
    config.uploads_dir.mkdir(parents=True, exist_ok=True)
    (config.uploads_dir / ".rag_index").mkdir(parents=True, exist_ok=True)
    registry.reload_keys()
    yield
```

- [ ] **Step 4: Commit**

```bash
git add backend/rag/ backend/main.py
git commit -m "feat: RAG pipeline and retriever using RagAnything"
```

---

## Task 10: Documents Module

**Files:**
- Create: `backend/documents/schemas.py`
- Create: `backend/documents/service.py`
- Create: `backend/documents/watcher.py`
- Create: `backend/documents/router.py`
- Create: `backend/tests/test_documents_api.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_documents_api.py
import pytest
import io
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_list_documents_empty(client):
    resp = await client.get("/documents")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_upload_document(client, tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello RAG world")

    with patch("documents.service.ingest_file", new_callable=AsyncMock):
        resp = await client.post(
            "/documents/upload",
            files={"file": ("test.txt", test_file.read_bytes(), "text/plain")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test.txt"
    assert data["status"] == "processing"


@pytest.mark.asyncio
async def test_delete_document(client, tmp_path):
    test_file = tmp_path / "del.txt"
    test_file.write_text("delete me")

    with patch("documents.service.ingest_file", new_callable=AsyncMock):
        upload = await client.post(
            "/documents/upload",
            files={"file": ("del.txt", test_file.read_bytes(), "text/plain")},
        )
    doc_id = upload.json()["id"]

    with patch("documents.service.delete_file", new_callable=AsyncMock):
        resp = await client.delete(f"/documents/{doc_id}")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_documents_api.py -v
```

Expected: `ModuleNotFoundError: No module named 'documents'`

- [ ] **Step 3: Create `backend/documents/schemas.py`**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: uuid.UUID
    name: str
    file_type: str
    size_bytes: int | None
    status: str
    source: str
    file_path: str | None
    indexed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Create `backend/documents/service.py`**

```python
import asyncio
import uuid
from pathlib import Path
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import Document
from rag.pipeline import ingest_file, delete_file
from core.config import config


async def list_documents(db: AsyncSession) -> list[Document]:
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    return result.scalars().all()


async def upload_document(
    db: AsyncSession, filename: str, content: bytes, source: str = "upload"
) -> Document:
    dest = config.uploads_dir / filename
    dest.write_bytes(content)

    doc = Document(
        id=uuid.uuid4(),
        name=filename,
        file_type=Path(filename).suffix.lstrip(".") or "unknown",
        size_bytes=len(content),
        status="processing",
        source=source,
        file_path=str(dest),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Ingest in background — update status when done
    asyncio.create_task(_run_ingest(doc.id, str(dest)))
    return doc


async def _run_ingest(doc_id: uuid.UUID, file_path: str) -> None:
    from db.session import AsyncSessionLocal
    try:
        await ingest_file(file_path)
        status, indexed_at = "ready", datetime.utcnow()
    except Exception:
        status, indexed_at = "failed", None

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Document).where(Document.id == doc_id)
        )
        doc = result.scalar_one_or_none()
        if doc:
            doc.status = status
            doc.indexed_at = indexed_at
            await session.commit()


async def delete_document(db: AsyncSession, doc_id: uuid.UUID) -> bool:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        return False
    if doc.file_path:
        await delete_file(doc.file_path)
        Path(doc.file_path).unlink(missing_ok=True)
    await db.delete(doc)
    await db.commit()
    return True
```

- [ ] **Step 5: Create `backend/documents/router.py`**

```python
import uuid
from fastapi import APIRouter, Depends, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from documents import service
from documents.schemas import DocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    return await service.list_documents(db)


@router.post("/upload", response_model=DocumentOut)
async def upload_document(file: UploadFile, db: AsyncSession = Depends(get_db)):
    content = await file.read()
    return await service.upload_document(db, file.filename, content)


@router.delete("/{doc_id}")
async def delete_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await service.delete_document(db, doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
```

- [ ] **Step 6: Create `backend/documents/watcher.py`**

```python
import asyncio
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileDeletedEvent


class FolderHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop, db_factory):
        self._loop = loop
        self._db_factory = db_factory

    def on_created(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                self._ingest(event.src_path), self._loop
            )

    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                self._remove(event.src_path), self._loop
            )

    async def _ingest(self, path: str):
        from documents.service import upload_document
        from rag.pipeline import ingest_file
        async with self._db_factory() as db:
            content = Path(path).read_bytes()
            await upload_document(db, Path(path).name, content, source="folder")

    async def _remove(self, path: str):
        from rag.pipeline import delete_file
        await delete_file(path)


_observer: Observer | None = None


def start_watcher(folders: list[str], loop: asyncio.AbstractEventLoop, db_factory):
    global _observer
    stop_watcher()
    if not folders:
        return
    _observer = Observer()
    handler = FolderHandler(loop, db_factory)
    for folder in folders:
        if Path(folder).is_dir():
            _observer.schedule(handler, folder, recursive=True)
    _observer.start()


def stop_watcher():
    global _observer
    if _observer and _observer.is_alive():
        _observer.stop()
        _observer.join()
    _observer = None
```

- [ ] **Step 7: Start watcher in lifespan — update `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from settings.router import router as settings_router
from documents.router import router as documents_router
from llm.registry import registry


@asynccontextmanager
async def lifespan(app):
    from core.config import config
    from settings.service import SettingsService
    from documents.watcher import start_watcher, stop_watcher
    from db.session import AsyncSessionLocal

    config.uploads_dir.mkdir(parents=True, exist_ok=True)
    (config.uploads_dir / ".rag_index").mkdir(parents=True, exist_ok=True)
    registry.reload_keys()

    svc = SettingsService()
    folders = svc.get().get("watched_folders", [])
    loop = asyncio.get_event_loop()
    start_watcher(folders, loop, AsyncSessionLocal)

    yield
    stop_watcher()


app = FastAPI(title="PTChat API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)
app.include_router(documents_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 8: Run tests — expect pass**

```bash
pytest tests/test_documents_api.py -v
```

Expected: 3 passed

- [ ] **Step 9: Commit**

```bash
git add backend/documents/ backend/main.py
git commit -m "feat: documents module — upload, list, delete, folder watcher"
```

---

## Task 11: Chat Module

**Files:**
- Create: `backend/chat/schemas.py`
- Create: `backend/chat/service.py`
- Create: `backend/chat/router.py`
- Create: `backend/tests/test_chat_api.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_chat_api.py
import pytest


@pytest.mark.asyncio
async def test_create_session(client):
    resp = await client.post("/sessions", json={
        "name": "Test Chat",
        "llm_provider": "ollama",
        "llm_model": "llama3",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Chat"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_sessions(client):
    await client.post("/sessions", json={
        "name": "Session A", "llm_provider": "ollama", "llm_model": "llama3"
    })
    resp = await client.get("/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_messages_empty(client):
    sess = await client.post("/sessions", json={
        "name": "Msg Test", "llm_provider": "ollama", "llm_model": "llama3"
    })
    sid = sess.json()["id"]
    resp = await client.get(f"/sessions/{sid}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_session(client):
    sess = await client.post("/sessions", json={
        "name": "Del Me", "llm_provider": "ollama", "llm_model": "llama3"
    })
    sid = sess.json()["id"]
    resp = await client.delete(f"/sessions/{sid}")
    assert resp.status_code == 200
    check = await client.get(f"/sessions/{sid}/messages")
    assert check.status_code == 404
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_chat_api.py -v
```

Expected: `ModuleNotFoundError: No module named 'chat'`

- [ ] **Step 3: Create `backend/chat/schemas.py`**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class SessionCreate(BaseModel):
    name: str
    llm_provider: str
    llm_model: str


class SessionOut(BaseModel):
    id: uuid.UUID
    name: str
    llm_provider: str
    llm_model: str
    created_at: datetime
    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    content: str
```

- [ ] **Step 4: Create `backend/chat/service.py`**

```python
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import Session as ChatSession, Message


async def create_session(
    db: AsyncSession, name: str, llm_provider: str, llm_model: str
) -> ChatSession:
    session = ChatSession(
        id=uuid.uuid4(),
        name=name,
        llm_provider=llm_provider,
        llm_model=llm_model,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_sessions(db: AsyncSession) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession).order_by(ChatSession.created_at.desc())
    )
    return result.scalars().all()


async def get_session(db: AsyncSession, session_id: uuid.UUID) -> ChatSession | None:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def get_messages(db: AsyncSession, session_id: uuid.UUID) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


async def add_message(
    db: AsyncSession, session_id: uuid.UUID, role: str, content: str
) -> Message:
    msg = Message(
        id=uuid.uuid4(), session_id=session_id, role=role, content=content
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def delete_session(db: AsyncSession, session_id: uuid.UUID) -> bool:
    session = await get_session(db, session_id)
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True


async def rename_session(
    db: AsyncSession, session_id: uuid.UUID, name: str
) -> ChatSession | None:
    session = await get_session(db, session_id)
    if not session:
        return None
    session.name = name
    await db.commit()
    await db.refresh(session)
    return session
```

- [ ] **Step 5: Create `backend/chat/router.py`**

```python
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from chat import service
from chat.schemas import SessionCreate, SessionOut, MessageOut, ChatRequest
from llm.registry import registry
from llm.base import Message
from rag.retriever import augment_messages

router = APIRouter(tags=["chat"])


@router.post("/sessions", response_model=SessionOut)
async def create_session(body: SessionCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_session(db, body.name, body.llm_provider, body.llm_model)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    return await service.list_sessions(db)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    sess = await service.get_session(db, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return await service.get_messages(db, session_id)


@router.patch("/sessions/{session_id}")
async def rename_session(
    session_id: uuid.UUID, body: dict, db: AsyncSession = Depends(get_db)
):
    sess = await service.rename_session(db, session_id, body["name"])
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await service.delete_session(db, session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.post("/sessions/{session_id}/chat")
async def chat(
    session_id: uuid.UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    sess = await service.get_session(db, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Persist user message
    await service.add_message(db, session_id, "user", body.content)

    # Build message history for LLM
    history = await service.get_messages(db, session_id)
    messages = [Message(role=m.role, content=m.content) for m in history]
    messages = await augment_messages(messages)

    provider = registry.get(sess.llm_provider)

    async def event_stream():
        full_response = []
        try:
            async for token in provider.chat(messages, model=sess.llm_model):
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        finally:
            # Persist assistant response
            if full_response:
                import asyncio
                from db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as persist_db:
                    await service.add_message(
                        persist_db, session_id, "assistant", "".join(full_response)
                    )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 6: Register chat router in `backend/main.py`**

Add to imports and registration:

```python
from chat.router import router as chat_router
# ...
app.include_router(chat_router)
```

- [ ] **Step 7: Run tests — expect pass**

```bash
pytest tests/test_chat_api.py -v
```

Expected: 4 passed

- [ ] **Step 8: Run all tests**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add backend/chat/ backend/main.py
git commit -m "feat: chat module — sessions, messages, SSE streaming with RAG context"
```

---

## Task 12: Final Integration Smoke Test

- [ ] **Step 1: Start the full stack**

```bash
docker compose up -d
cd backend && uvicorn main:app --reload
```

- [ ] **Step 2: Verify all endpoints are reachable**

```bash
curl http://localhost:8000/health
# → {"status":"ok"}

curl http://localhost:8000/settings
# → {"theme":"system","ollama_endpoint":"http://localhost:11434","watched_folders":[]}

curl http://localhost:8000/settings/providers
# → JSON list of all 4 providers

curl http://localhost:8000/documents
# → []

curl http://localhost:8000/sessions
# → []
```

- [ ] **Step 3: Run the full test suite one final time**

```bash
pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

---

## Done

Backend is complete. Proceed with the frontend plan (`2026-04-04-frontend-implementation.md`).

API contracts the frontend depends on:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/settings` | GET / PATCH | App settings |
| `/settings/providers` | GET | LLM provider list + models |
| `/settings/api-keys/{provider}` | PUT / DELETE | Manage API keys |
| `/documents` | GET | List documents |
| `/documents/upload` | POST | Upload file |
| `/documents/{id}` | DELETE | Delete document |
| `/sessions` | GET / POST | Session management |
| `/sessions/{id}` | PATCH / DELETE | Rename / delete session |
| `/sessions/{id}/messages` | GET | Message history |
| `/sessions/{id}/chat` | POST (SSE) | Send message + stream response |
