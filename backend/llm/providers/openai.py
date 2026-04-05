from typing import AsyncIterator
import openai
from llm.base import LLMProvider, Message


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _client(self):
        return openai.AsyncOpenAI(api_key=self.api_key)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        client = self._client()
        oai_messages = [{"role": m.role, "content": m.content} for m in messages]
        if stream:
            async with client.chat.completions.stream(
                model=model, messages=oai_messages
            ) as s:
                async for chunk in s:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
        else:
            resp = await client.chat.completions.create(
                model=model, messages=oai_messages
            )
            yield resp.choices[0].message.content
