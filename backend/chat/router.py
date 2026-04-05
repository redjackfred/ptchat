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
from rag.retriever import augment_messages, get_tools

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
async def patch_session(
    session_id: uuid.UUID, body: dict, db: AsyncSession = Depends(get_db)
):
    if "name" in body:
        sess = await service.rename_session(db, session_id, body["name"])
    elif "llm_provider" in body and "llm_model" in body:
        sess = await service.update_session_model(
            db, session_id, body["llm_provider"], body["llm_model"]
        )
    else:
        raise HTTPException(status_code=400, detail="Provide 'name' or 'llm_provider'+'llm_model'")
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
    # Attach images to the last user message
    if body.images:
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].role == "user":
                messages[i] = Message(role="user", content=messages[i].content, images=body.images)
                break
    messages = await augment_messages(messages)

    provider = registry.get(sess.llm_provider)
    tools = get_tools()

    async def event_stream():
        full_response = []
        try:
            stream = (
                provider.chat_with_tools(messages, model=sess.llm_model, tools=tools)
                if tools and hasattr(provider, "chat_with_tools")
                else provider.chat(messages, model=sess.llm_model)
            )
            async for token in stream:
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if full_response:
                from db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as persist_db:
                    await service.add_message(
                        persist_db, session_id, "assistant", "".join(full_response)
                    )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
