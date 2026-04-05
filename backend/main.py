from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from settings.router import router as settings_router
from documents.router import router as documents_router
from chat.router import router as chat_router
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
app.include_router(chat_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
