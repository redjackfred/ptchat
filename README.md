# PTChat

A self-hosted AI chat application with multi-provider LLM support and Retrieval-Augmented Generation (RAG).

## Features

- **Multi-provider LLM** — switch between OpenAI, Anthropic Claude, Google Gemini, and Ollama (local) per session
- **Streaming responses** — token-by-token output via Server-Sent Events
- **RAG pipeline** — upload documents (PDF, text, images) and have them semantically searched during chat
- **Multimodal input** — paste or attach images directly in the chat box
- **Session management** — create, rename, and search chat sessions; each session can use a different model
- **Secure key storage** — API keys are stored in the OS keyring (not plain text)
- **Themes** — light, dark, and system-default

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.14, SQLAlchemy (async) |
| Database | PostgreSQL 16 + pgvector |
| Embeddings | OpenAI `text-embedding-3-small` |
| Image RAG | GPT-4o-mini vision (auto-describes images before embedding) |

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+
- Python 3.14+

## Getting Started

### 1. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance with pgvector at `localhost:5432`.

### 2. Configure the backend

```bash
cd backend
cp .env.example .env   # or create .env manually
```

`.env` minimum required:

```env
DATABASE_URL=postgresql+asyncpg://ptchat:ptchat@localhost:5432/ptchat
```

### 3. Run database migrations

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### 4. Start the backend

```bash
uvicorn main:app --reload
```

The API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### 6. Add API keys

Go to **Settings** in the UI and enter your API keys for the providers you want to use. Keys are stored securely in the OS keyring.

| Provider | Key required |
|---|---|
| OpenAI | Yes (also required for RAG embeddings) |
| Anthropic | Yes |
| Google Gemini | Yes |
| Ollama | No (local) |

## Project Structure

```
ptchat/
├── backend/
│   ├── chat/          # Chat sessions and message streaming
│   ├── documents/     # Document upload and management
│   ├── llm/           # Provider abstraction (OpenAI, Anthropic, Google, Ollama)
│   ├── rag/           # Embedding pipeline and vector retrieval
│   ├── settings/      # App settings and keyring API key management
│   ├── db/            # SQLAlchemy models and session
│   ├── alembic/       # Database migrations
│   └── main.py        # FastAPI app entry point
└── frontend/
    ├── app/           # Next.js pages (chat, documents, settings)
    ├── components/    # UI components
    ├── hooks/         # React hooks (chat stream, session, etc.)
    └── lib/           # API client and type definitions
```

## RAG — Document Indexing

Upload files via the **Documents** page or configure a watched folder in Settings. Supported formats:

- **Text**: `.txt`, `.md`, and any UTF-8 file
- **PDF**: text is extracted page by page
- **Images**: `.jpg`, `.png`, `.webp`, `.gif`, `.bmp` — GPT-4o-mini generates a detailed description before embedding

When you send a message, the top-5 most relevant chunks are retrieved and injected into the system prompt automatically.

> RAG indexing requires an OpenAI API key for embeddings, regardless of which chat provider is active.

## Running Tests

**Backend:**

```bash
cd backend
pytest
```

**Frontend:**

```bash
cd frontend
npm test
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `UPLOADS_DIR` | `./uploads` | Where uploaded files are stored |
| `SETTINGS_FILE` | `~/.ptchat/settings.json` | Path to persisted UI settings |

Ollama endpoint can be configured in the Settings UI (default: `http://localhost:11434`).

## License

MIT
