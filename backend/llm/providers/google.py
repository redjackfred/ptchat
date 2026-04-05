from typing import AsyncIterator
from llm.base import LLMProvider, Message


class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        yield ""  # Full implementation in Task 8
