import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from llm.registry import registry
from llm.base import LLMProvider, Message
from llm.providers.openai import OpenAIProvider
from llm.providers.anthropic import AnthropicProvider


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


@pytest.mark.asyncio
async def test_openai_chat_streams_tokens():
    provider = OpenAIProvider(api_key="sk-fake")

    fake_chunk = MagicMock()
    fake_chunk.choices = [MagicMock()]
    fake_chunk.choices[0].delta.content = "Hello"

    async def fake_stream():
        yield fake_chunk

    with patch("llm.providers.openai.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=fake_stream())
        cm.__aexit__ = AsyncMock(return_value=False)
        instance.chat.completions.stream.return_value = cm

        tokens = []
        async for token in provider.chat(
            [Message(role="user", content="hi")], model="gpt-4o"
        ):
            tokens.append(token)

    assert "Hello" in tokens


@pytest.mark.asyncio
async def test_anthropic_chat_streams_tokens():
    provider = AnthropicProvider(api_key="fake-key")

    fake_event = MagicMock()
    fake_event.type = "content_block_delta"
    fake_event.delta = MagicMock()
    fake_event.delta.text = "World"

    async def fake_stream():
        yield fake_event

    with patch("llm.providers.anthropic.anthropic.AsyncAnthropic") as MockClient:
        instance = MockClient.return_value
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=fake_stream())
        cm.__aexit__ = AsyncMock(return_value=False)
        instance.messages.stream.return_value = cm

        tokens = []
        async for token in provider.chat(
            [Message(role="user", content="hi")], model="claude-sonnet-4-6"
        ):
            tokens.append(token)

    assert "World" in tokens
