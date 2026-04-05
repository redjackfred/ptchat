import pytest
from llm.registry import registry
from llm.base import LLMProvider


def test_registry_has_all_builtin_providers():
    names = registry.list_providers()
    assert "openai" in names
    assert "anthropic" in names
    assert "google" in names
    assert "ollama" in names


def test_get_provider_returns_llmprovider_instance():
    provider = registry.get("ollama")
    assert isinstance(provider, LLMProvider)


def test_get_unknown_provider_raises():
    with pytest.raises(KeyError):
        registry.get("nonexistent")


def test_provider_has_required_methods():
    provider = registry.get("ollama")
    assert hasattr(provider, "chat")
    assert hasattr(provider, "supports_vision")
    assert hasattr(provider, "available_models")
    assert callable(provider.supports_vision)
    assert isinstance(provider.available_models(), list)
