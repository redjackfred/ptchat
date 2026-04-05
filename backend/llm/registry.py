from llm.base import LLMProvider
from llm.providers.ollama import OllamaProvider
from llm.providers.openai import OpenAIProvider
from llm.providers.anthropic import AnthropicProvider
from llm.providers.google import GoogleProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, LLMProvider] = {}

    def register(self, name: str, provider: LLMProvider) -> None:
        self._providers[name] = provider

    def get(self, name: str) -> LLMProvider:
        if name not in self._providers:
            raise KeyError(f"Unknown provider: {name!r}")
        return self._providers[name]

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())

    def reload_keys(self) -> None:
        """Re-read API keys from keyring and reinitialise providers."""
        from settings.service import SettingsService
        svc = SettingsService()
        settings = svc.get()
        ollama_url = settings.get("ollama_endpoint", "http://localhost:11434")
        self._providers["ollama"] = OllamaProvider(base_url=ollama_url)
        self._providers["openai"] = OpenAIProvider(
            api_key=svc.get_api_key("openai") or ""
        )
        self._providers["anthropic"] = AnthropicProvider(
            api_key=svc.get_api_key("anthropic") or ""
        )
        self._providers["google"] = GoogleProvider(
            api_key=svc.get_api_key("google") or ""
        )


registry = ProviderRegistry()
# Register with stubs initially (settings module not loaded yet)
registry.register("ollama", OllamaProvider())
registry.register("openai", OpenAIProvider(api_key=""))
registry.register("anthropic", AnthropicProvider(api_key=""))
registry.register("google", GoogleProvider(api_key=""))
