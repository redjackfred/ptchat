from rag.pipeline import query as rag_query
from llm.base import Message


async def build_rag_context(user_message: str) -> str:
    """Query the RAG store and return context string."""
    context = await rag_query(user_message)
    if not context:
        return ""
    return (
        "Use the following retrieved context to answer the user's question. "
        "If the context is not relevant, answer from your own knowledge.\n\n"
        f"<context>\n{context}\n</context>"
    )


async def augment_messages(messages: list[Message]) -> list[Message]:
    """
    Prepend a RAG context system message to the conversation.
    Uses the last user message as the query.
    """
    last_user = next(
        (m.content for m in reversed(messages) if m.role == "user"), None
    )
    if not last_user:
        return messages

    context_msg = await build_rag_context(last_user)
    if not context_msg:
        return messages

    non_system = [m for m in messages if m.role != "system"]
    return [Message(role="system", content=context_msg)] + non_system
