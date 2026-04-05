from typing import AsyncIterator
from llm.base import LLMProvider, Message


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        yield ""  # Full implementation in Task 7
