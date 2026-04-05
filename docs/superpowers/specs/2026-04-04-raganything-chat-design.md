# RagAnything Chat — Design Spec

**Date:** 2026-04-04  
**Status:** Approved  
**Type:** Personal AI Chat Application

---

## Overview

A personal AI chat application powered by RagAnything, featuring a ChatGPT-like interface with multi-LLM support, multi-modal RAG, and an extensible modular architecture. The user can upload or monitor local files as a knowledge base, then converse with any supported LLM using RAG-augmented context.

---

## Goals

- ChatGPT-like UX with support for multiple LLM providers (OpenAI, Claude, Gemini, Ollama)
- Multi-modal RAG: text, PDF, images, video, audio, code
- Document management via UI upload and local folder monitoring
- Extensible architecture ready for agents, plugins, and additional features
- Personal tool (single user, local deployment)

---

## Architecture

**Pattern:** Modular Monolith

```
┌─────────────────────────────────────┐
│         Next.js 前端                │
│  Chat UI │ 文件管理 │ 設定（API Key）│
└────────────────┬────────────────────┘
                 │ REST / SSE
┌────────────────▼────────────────────┐
│         FastAPI 後端                │
│                                     │
│  ┌─────────┐  ┌─────────────────┐  │
│  │ chat/   │  │ documents/      │  │
│  │ 對話管理 │  │ 上傳+資料夾監控  │  │
│  └────┬────┘  └───────┬─────────┘  │
│       │               │             │
│  ┌────▼────┐  ┌───────▼─────────┐  │
│  │  llm/   │  │    rag/         │  │
│  │Provider │  │ RagAnything     │  │
│  │ 抽象層  │  │ 索引+查詢       │  │
│  └─────────┘  └─────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ settings/ (API keys, 設定)  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         │
    PostgreSQL + pgvector
   (對話歷史 + 向量索引)
```

Each domain module exposes its own FastAPI router, service layer, and Pydantic schemas. Modules communicate only through well-defined service interfaces — no cross-domain direct DB queries.

---

## Tech Stack

### Backend
| Layer | Choice |
|---|---|
| Framework | FastAPI |
| RAG Engine | RagAnything |
| Vector + Relational DB | PostgreSQL + pgvector |
| ORM | SQLAlchemy (async) |
| File monitoring | watchdog |
| API Key storage | keyring (system keychain) |
| Streaming | Server-Sent Events (SSE) |

### Frontend
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Component Library | shadcn/ui (Radix UI + Tailwind) |
| Visual Effects | Aceternity UI (Framer Motion) |
| Styling | Tailwind CSS |
| Markdown rendering | react-markdown + rehype-highlight |

### Infrastructure
| Concern | Choice |
|---|---|
| Local database | PostgreSQL via Docker Compose |
| Environment | `.env` for DB connection, `keyring` for secrets |

---

## Backend Modules

### `llm/` — LLM Provider Abstraction

```python
class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message], stream: bool = True) -> AsyncIterator[str]: ...

    @abstractmethod
    def supports_vision(self) -> bool: ...

    @abstractmethod
    def available_models(self) -> list[str]: ...
```

Built-in providers registered at startup:

| Provider | Auth | Notes |
|---|---|---|
| OpenAI | API Key | GPT-4o, GPT-4o-mini, etc. |
| Anthropic | API Key | Claude 3.5 Sonnet, Haiku, Opus |
| Google | API Key or OAuth | Gemini 1.5 Pro, Flash |
| Ollama | None | Auto-detect `localhost:11434` |

**Adding a new provider:** Create a new file implementing `LLMProvider`, register in the provider registry. The frontend selector updates automatically — no other code changes needed.

### `rag/` — RAG Pipeline

Document ingestion flow:
```
Input (any file type)
  → RagAnything processing
     ├── Text/Markdown → chunking
     ├── PDF → structure + figure extraction
     ├── Images/Video → multi-modal understanding
     └── Code → syntax-aware chunking
  → Embed → store in pgvector
  → Available for hybrid retrieval (semantic + keyword)
```

At query time: retrieve top-k chunks → inject as context → stream to LLM.

### `documents/` — Document Management

- Upload endpoint: accepts any file type, queues for RagAnything processing
- Folder watcher: `watchdog` monitors configured local directories, auto-ingests new/modified files, removes deleted files from vector index
- Document metadata stored in PostgreSQL: name, type, size, status (`processing` / `ready` / `failed`), indexed_at

### `chat/` — Conversation Management

- Session model: id, name, created_at, llm_provider, llm_model
- Message model: id, session_id, role, content, created_at
- All sessions and messages persisted in PostgreSQL
- SSE endpoint streams LLM tokens to frontend

### `settings/` — Configuration

- API keys stored via `keyring` (system keychain, never in DB or `.env`)
- Settings stored in `~/.raganything-chat/settings.json`: theme, Ollama endpoint, watched folders
- Exposed via REST endpoints for the settings UI

---

## Frontend Pages & Components

### Chat Page (Main)
- **Left sidebar** (shadcn/ui `Sidebar`): session list, new/delete/rename session
- **Top bar**: current session name + LLM provider/model dropdown (shadcn/ui `Select`)
- **Message area**: streaming Markdown with code highlighting; AI messages use Aceternity Typewriter effect
- **Input area**: multi-line input, file attachment, send button
- **Background**: Aceternity Spotlight or Aurora effect on the welcome/empty state

### Document Management Page
- Aceternity File Upload component (drag-and-drop)
- Indexed document list: name, type, status badge, size, delete action
- Folder monitoring panel: path input, enable/disable toggle, status indicator

### Settings Page
- Per-provider API key inputs (masked after entry, reset button)
- Ollama endpoint field (default: `localhost:11434`)
- Theme toggle: Dark / Light / System (shadcn/ui `Switch`)
- PostgreSQL connection string field

### Theme
- Dark + Light mode, switchable manually or follows system preference
- Tailwind `dark:` variants throughout; toggled via `next-themes`

---

## Data Model

```sql
-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'processing',
  source TEXT NOT NULL CHECK (source IN ('upload', 'folder')),
  file_path TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- pgvector extension handles embeddings
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Extensibility Points

The modular monolith is designed with clear seams for future additions:

| Future Feature | Where to Add |
|---|---|
| Agent / Tool calling | New `agents/` module; `LLMProvider` interface already streams |
| Web search tool | Agent tool in `agents/tools/` |
| Plugin system | Hook registry in `core/hooks.py`; modules emit events |
| Additional LLM providers | New file in `llm/providers/`, register in registry |
| Voice input/output | New `voice/` module, new frontend component |
| Sharing / export | New `export/` module |

---

## Project Structure

```
raganything-chat/
├── backend/
│   ├── main.py
│   ├── core/
│   │   └── config.py
│   ├── llm/
│   │   ├── base.py          # LLMProvider ABC
│   │   ├── registry.py
│   │   └── providers/
│   │       ├── openai.py
│   │       ├── anthropic.py
│   │       ├── google.py
│   │       └── ollama.py
│   ├── rag/
│   │   ├── pipeline.py
│   │   └── retriever.py
│   ├── chat/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── documents/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── watcher.py       # watchdog folder monitor
│   │   └── schemas.py
│   ├── settings/
│   │   ├── router.py
│   │   └── service.py       # keyring integration
│   └── db/
│       ├── models.py
│       └── session.py
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Chat
│   │   ├── documents/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── components/
│   │   ├── chat/
│   │   ├── documents/
│   │   └── settings/
│   └── lib/
│       └── api.ts
└── docker-compose.yml        # PostgreSQL + pgvector
```

---

## Local Development Setup

```bash
# Start PostgreSQL with pgvector
docker compose up -d

# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend && npm install
npm run dev
```

---

## Out of Scope (for now)

- Multi-user / authentication
- Cloud deployment
- Billing / usage tracking
- Mobile app
