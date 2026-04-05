from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str
    images: list[str] = field(default_factory=list)  # base64 data URLs


class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        ...

    @abstractmethod
    def supports_vision(self) -> bool:
        ...

    @abstractmethod
    def available_models(self) -> list[str]:
        ...
