import pytest
from settings.service import SettingsService


def test_get_settings_returns_defaults():
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    s = svc.get()
    assert s["theme"] == "system"
    assert s["ollama_endpoint"] == "http://localhost:11434"
    assert s["watched_folders"] == []


def test_update_theme():
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    svc.update({"theme": "dark"})
    assert svc.get()["theme"] == "dark"
    # reset
    svc.update({"theme": "system"})


def test_set_and_get_api_key(monkeypatch):
    """keyring stores and retrieves without touching disk."""
    stored = {}

    def fake_set(service, username, password):
        stored[(service, username)] = password

    def fake_get(service, username):
        return stored.get((service, username))

    monkeypatch.setattr("keyring.set_password", fake_set)
    monkeypatch.setattr("keyring.get_password", fake_get)

    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    svc.set_api_key("openai", "sk-test-key")
    assert svc.get_api_key("openai") == "sk-test-key"


def test_missing_api_key_returns_none(monkeypatch):
    monkeypatch.setattr("keyring.get_password", lambda s, u: None)
    svc = SettingsService(settings_file="/tmp/test_ptchat_settings.json")
    assert svc.get_api_key("openai") is None
