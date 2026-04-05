from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str


class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self, messages: list[Message], model: str, stream: bool = True
    ) -> AsyncIterator[str]:
        """Yield token strings. If stream=False, yield a single complete string."""
        ...

    @abstractmethod
    def supports_vision(self) -> bool:
        """Returns True if this provider can handle image inputs."""
        ...

    @abstractmethod
    def available_models(self) -> list[str]:
        """Returns the list of model IDs available for this provider."""
        ...
