import os
from rag.pipeline import query as rag_query
from rag.tools import list_folder_files, ALL_TOOLS
from llm.base import Message


async def _build_system_prompt(user_message: str) -> str:
    """
    Build the system prompt:
    - Watched folders: listed from filesystem (no RAG needed)
    - Uploaded files: semantic search via RAG
    """
    parts: list[str] = []

    # 1. Watched folder structure
    folder_files = list_folder_files()
    if folder_files:
        lines = ["You have access to the following monitored folders.",
                 "Use the read_file tool to read any file when needed.\n"]
        for folder, files in folder_files.items():
            lines.append(f"Folder: {folder}")
            for f in files:
                lines.append(f"  - {f}")
        parts.append("\n".join(lines))

    # 2. RAG context from uploaded/indexed files
    rag_context = await rag_query(user_message)
    if rag_context:
        parts.append(
            "Relevant context from indexed uploaded files:\n\n"
            f"<context>\n{rag_context}\n</context>"
        )

    return "\n\n".join(parts)


async def augment_messages(messages: list[Message]) -> list[Message]:
    last_user = next(
        (m.content for m in reversed(messages) if m.role == "user"), None
    )
    if not last_user:
        return messages

    system_content = await _build_system_prompt(last_user)
    non_system = [m for m in messages if m.role != "system"]
    if not system_content:
        return non_system
    return [Message(role="system", content=system_content)] + non_system


def get_tools() -> list[dict] | None:
    """Return tools if there are watched folders with files, else None."""
    return ALL_TOOLS if list_folder_files() else None
