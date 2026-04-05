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
