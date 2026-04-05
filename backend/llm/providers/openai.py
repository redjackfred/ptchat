import json
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

    async def resolve_tools(
        self,
        oai_messages: list[dict],  # already formatted
        model: str,
        tools: list[dict],
        max_rounds: int = 5,
    ) -> list[dict]:
        """
        Run non-streaming tool-call rounds until the model stops calling tools.
        Returns the extra assistant + tool messages to append before streaming.
        """
        from rag.tools import execute_tool

        extra: list[dict] = []
        for _ in range(max_rounds):
            response = await self._client().chat.completions.create(
                model=model,
                messages=oai_messages + extra,
                tools=tools,
                tool_choice="auto",
            )
            msg = response.choices[0].message
            if not msg.tool_calls:
                break

            assistant_entry: dict = {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            }
            extra.append(assistant_entry)

            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments)
                result = execute_tool(tc.function.name, args)
                extra.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

        return extra

    @staticmethod
    def _format_message(m: Message) -> dict:
        if not m.images:
            return {"role": m.role, "content": m.content}
        content: list[dict] = [{"type": "text", "text": m.content}]
        for img in m.images:
            content.append({"type": "image_url", "image_url": {"url": img}})
        return {"role": m.role, "content": content}

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        client = self._client()
        oai_messages = [self._format_message(m) for m in messages]
        if stream:
            s = await client.chat.completions.create(
                model=model, messages=oai_messages, stream=True
            )
            async for chunk in s:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            resp = await client.chat.completions.create(
                model=model, messages=oai_messages
            )
            yield resp.choices[0].message.content

    async def chat_with_tools(
        self, messages: list[Message], model: str, tools: list[dict]
    ) -> AsyncIterator[str]:
        """Resolve tool calls first, then stream the final response."""
        oai_messages = [self._format_message(m) for m in messages]
        extra = await self.resolve_tools(oai_messages, model, tools)
        final_messages = oai_messages + extra

        client = self._client()
        s = await client.chat.completions.create(
            model=model, messages=final_messages, stream=True
        )
        async for chunk in s:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
