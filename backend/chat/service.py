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


async def update_session_model(
    db: AsyncSession, session_id: uuid.UUID, llm_provider: str, llm_model: str
) -> ChatSession | None:
    session = await get_session(db, session_id)
    if not session:
        return None
    session.llm_provider = llm_provider
    session.llm_model = llm_model
    await db.commit()
    await db.refresh(session)
    return session
