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
    dest.parent.mkdir(parents=True, exist_ok=True)
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

    asyncio.create_task(_run_ingest(doc.id, str(dest)))
    return doc


async def index_file_in_place(
    db: AsyncSession, file_path: str
) -> Document:
    """Index a file without copying it — used for folder monitoring."""
    path = Path(file_path)
    doc = Document(
        id=uuid.uuid4(),
        name=path.name,
        file_type=path.suffix.lstrip(".") or "unknown",
        size_bytes=path.stat().st_size if path.exists() else 0,
        status="processing",
        source="folder",
        file_path=file_path,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    asyncio.create_task(_run_ingest(doc.id, file_path))
    return doc


async def _run_ingest(doc_id: uuid.UUID, file_path: str) -> None:
    from db.session import AsyncSessionLocal
    try:
        await ingest_file(file_path, document_id=doc_id)
        status, indexed_at = "ready", datetime.utcnow()
    except asyncio.CancelledError:
        return
    except Exception:
        status, indexed_at = "failed", None

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Document).where(Document.id == doc_id)
            )
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = status
                doc.indexed_at = indexed_at
                await session.commit()
    except asyncio.CancelledError:
        return
    except Exception:
        pass


async def delete_all_documents(db: AsyncSession) -> None:
    result = await db.execute(select(Document))
    docs = result.scalars().all()
    for doc in docs:
        if doc.file_path:
            await delete_file(doc.file_path, document_id=doc.id)
            Path(doc.file_path).unlink(missing_ok=True)
        await db.delete(doc)
    await db.commit()


async def delete_document(db: AsyncSession, doc_id: uuid.UUID) -> bool:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        return False
    if doc.file_path:
        await delete_file(doc.file_path, document_id=doc_id)
        Path(doc.file_path).unlink(missing_ok=True)
    await db.delete(doc)
    await db.commit()
    return True
