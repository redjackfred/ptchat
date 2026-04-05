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

    await service.add_message(db, session_id, "user", body.content)

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
            if full_response:
                from db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as persist_db:
                    await service.add_message(
                        persist_db, session_id, "assistant", "".join(full_response)
                    )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
