import asyncio
import logging
from pathlib import Path
from core.config import config

logger = logging.getLogger(__name__)

try:
    from raganything import RagAnything as _RagAnything
    _RAG_AVAILABLE = True
except ImportError:
    _RagAnything = None
    _RAG_AVAILABLE = False
    logger.warning(
        "RagAnything not installed. RAG features disabled. "
        "Install with: pip install raganything"
    )

_rag = None


def get_rag():
    global _rag
    if not _RAG_AVAILABLE:
        return None
    if _rag is None:
        index_dir = config.uploads_dir / ".rag_index"
        index_dir.mkdir(parents=True, exist_ok=True)
        _rag = _RagAnything(working_dir=str(index_dir))
    return _rag


async def ingest_file(file_path: str | Path) -> None:
    """Process and index a single file into the RAG store."""
    rag = get_rag()
    if rag is None:
        logger.warning(f"RAG not available, skipping ingest for {file_path}")
        return
    await asyncio.to_thread(rag.insert_file, str(file_path))


async def delete_file(file_path: str | Path) -> None:
    """Remove a file's chunks from the RAG store."""
    rag = get_rag()
    if rag is None:
        return
    try:
        await asyncio.to_thread(rag.delete_by_source, str(file_path))
    except Exception as e:
        logger.warning(f"Could not delete {file_path} from RAG: {e}")


async def query(text: str, top_k: int = 5) -> str:
    """
    Retrieve relevant context for a query.
    Returns a formatted string of retrieved chunks.
    """
    rag = get_rag()
    if rag is None:
        return ""
    try:
        results = await asyncio.to_thread(rag.query, text, top_k=top_k)
        if not results:
            return ""
        chunks = [r.get("content", "") for r in results if r.get("content")]
        return "\n\n---\n\n".join(chunks)
    except Exception as e:
        logger.warning(f"RAG query failed: {e}")
        return ""
