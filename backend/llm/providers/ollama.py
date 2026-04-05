from typing import AsyncIterator
import httpx
from llm.base import LLMProvider, Message


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    def supports_vision(self) -> bool:
        return False

    def available_models(self) -> list[str]:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=2)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return []

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
        }
        async with httpx.AsyncClient() as client:
            if stream:
                async with client.stream(
                    "POST", f"{self.base_url}/api/chat", json=payload, timeout=60
                ) as resp:
                    import json
                    async for line in resp.aiter_lines():
                        if line:
                            data = json.loads(line)
                            if content := data.get("message", {}).get("content"):
                                yield content
            else:
                resp = await client.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=60
                )
                yield resp.json()["message"]["content"]
