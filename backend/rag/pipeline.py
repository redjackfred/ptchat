"""
RAG pipeline using OpenAI embeddings + pgvector.
Chunks documents, embeds with text-embedding-3-small, stores in document_chunks.
Images are described via GPT-4o-mini vision before embedding.
"""
import asyncio
import base64
import logging
import uuid
from pathlib import Path

import openai

from db.session import AsyncSessionLocal
from db.models import DocumentChunk

logger = logging.getLogger(__name__)

EMBED_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
IMAGE_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif",
    ".webp": "image/webp", ".bmp": "image/bmp",
}


def _get_openai_key() -> str | None:
    try:
        from settings.service import SettingsService
        return SettingsService().get_api_key("openai")
    except Exception:
        return None


def _extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(file_path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            logger.warning(f"PDF extraction failed for {file_path}: {e}")
            return ""
    try:
        return file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.warning(f"Text extraction failed for {file_path}: {e}")
        return ""


async def _describe_image(file_path: Path, api_key: str) -> str:
    """Use GPT-4o-mini vision to produce a text description of an image."""
    suffix = file_path.suffix.lower()
    mime = IMAGE_MIME.get(suffix, "image/jpeg")
    data = await asyncio.to_thread(file_path.read_bytes)
    b64 = base64.b64encode(data).decode()
    client = openai.AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    {"type": "text", "text": (
                        "Describe this image in detail. "
                        "Include all visible text, objects, people, colours, and context."
                    )},
                ],
            }],
            max_tokens=600,
        )
        description = response.choices[0].message.content or ""
        logger.info(f"Image described: {file_path.name} ({len(description)} chars)")
        return description
    except Exception as e:
        logger.warning(f"Image description failed for {file_path}: {e}")
        return ""


def _chunk_text(text: str) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + CHUNK_SIZE])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c.strip() for c in chunks if c.strip()]


async def _embed(texts: list[str], api_key: str) -> list[list[float]]:
    client = openai.AsyncOpenAI(api_key=api_key)
    response = await client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in response.data]


async def ingest_file(file_path: str | Path, document_id: uuid.UUID | None = None) -> None:
    api_key = _get_openai_key()
    if not api_key:
        logger.warning("No OpenAI API key — RAG indexing skipped. Set key in Settings.")
        return

    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in IMAGE_EXTENSIONS:
        text = await _describe_image(path, api_key)
    else:
        text = await asyncio.to_thread(_extract_text, path)

    if not text.strip():
        logger.warning(f"No text extracted from {path} — skipping indexing")
        return

    chunks = _chunk_text(text)
    logger.info(f"Indexing {path.name}: {len(chunks)} chunk(s)")

    try:
        embeddings = await _embed(chunks, api_key)
    except Exception as e:
        logger.error(f"Embedding failed for {path}: {e}")
        raise

    async with AsyncSessionLocal() as db:
        if document_id:
            from sqlalchemy import delete
            await db.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
            )
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            db.add(DocumentChunk(
                id=uuid.uuid4(),
                document_id=document_id,
                chunk_index=i,
                content=chunk,
                embedding=embedding,
            ))
        await db.commit()
    logger.info(f"Indexed {len(chunks)} chunk(s) for {path.name}")


async def delete_file(file_path: str | Path, document_id: uuid.UUID | None = None) -> None:
    if not document_id:
        return
    async with AsyncSessionLocal() as db:
        from sqlalchemy import delete
        await db.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )
        await db.commit()


async def query(text: str, top_k: int = 5) -> str:
    api_key = _get_openai_key()
    if not api_key:
        return ""
    try:
        embeddings = await _embed([text], api_key)
        query_vec = embeddings[0]
    except Exception as e:
        logger.warning(f"Query embedding failed: {e}")
        return ""

    async with AsyncSessionLocal() as db:
        from sqlalchemy import text as sql_text
        result = await db.execute(
            sql_text(
                """
                SELECT dc.content, d.name
                FROM document_chunks dc
                LEFT JOIN documents d ON dc.document_id = d.id
                WHERE dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> CAST(:vec AS vector)
                LIMIT :k
                """
            ),
            {"vec": str(query_vec), "k": top_k},
        )
        rows = result.fetchall()

    if not rows:
        return ""
    parts = []
    for content, name in rows:
        header = f"[Source: {name}]\n" if name else ""
        parts.append(f"{header}{content}")
    return "\n\n---\n\n".join(parts)
