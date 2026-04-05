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
