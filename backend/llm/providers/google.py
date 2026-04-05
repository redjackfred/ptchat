from typing import AsyncIterator
import google.generativeai as genai
from llm.base import LLMProvider, Message


class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _model(self, model_id: str):
        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel(model_id)

    def supports_vision(self) -> bool:
        return True

    def available_models(self) -> list[str]:
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]

    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        gemini_model = self._model(model)
        history = []
        prompt = ""
        for m in messages:
            if m.role == "system":
                history.append({"role": "user", "parts": [m.content]})
                history.append({"role": "model", "parts": ["Understood."]})
            elif m.role == "user":
                prompt = m.content
            elif m.role == "assistant":
                history.append({"role": "model", "parts": [m.content]})

        chat = gemini_model.start_chat(history=history)
        if stream:
            response = await chat.send_message_async(prompt, stream=True)
            async for chunk in response:
                yield chunk.text
        else:
            response = await chat.send_message_async(prompt)
            yield response.text
