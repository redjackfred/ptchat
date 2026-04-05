from typing import AsyncIterator
import anthropic
from llm.base import LLMProvider, Message


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _client(self):
        return anthropic.AsyncAnthropic(api_key=self.api_key)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        client = self._client()
        system = next(
            (m.content for m in messages if m.role == "system"), None
        )
        user_messages = [
            {"role": m.role, "content": m.content}
            for m in messages if m.role != "system"
        ]
        kwargs = dict(model=model, max_tokens=4096, messages=user_messages)
        if system:
            kwargs["system"] = system

        if stream:
            async with client.messages.stream(**kwargs) as s:
                async for event in s:
                    if (
                        event.type == "content_block_delta"
                        and hasattr(event.delta, "text")
                    ):
                        yield event.delta.text
        else:
            resp = await client.messages.create(**kwargs)
            yield resp.content[0].text
