import json
import keyring
from pathlib import Path

KEYRING_SERVICE = "ptchat"
DEFAULTS = {
    "theme": "system",
    "ollama_endpoint": "http://localhost:11434",
    "watched_folders": [],
}


class SettingsService:
    def __init__(self, settings_file: str | None = None):
        from core.config import config
        self._path = Path(settings_file or config.settings_file).expanduser()

    def _load(self) -> dict:
        if self._path.exists():
            return json.loads(self._path.read_text())
        return {}

    def _save(self, data: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, indent=2))

    def get(self) -> dict:
        data = self._load()
        return {**DEFAULTS, **data}

    def update(self, patch: dict) -> dict:
        data = self._load()
        data.update(patch)
        self._save(data)
        return {**DEFAULTS, **data}

    def set_api_key(self, provider: str, key: str) -> None:
        keyring.set_password(KEYRING_SERVICE, provider, key)

    def get_api_key(self, provider: str) -> str | None:
        return keyring.get_password(KEYRING_SERVICE, provider)

    def delete_api_key(self, provider: str) -> None:
        try:
            keyring.delete_password(KEYRING_SERVICE, provider)
        except keyring.errors.PasswordDeleteError:
            pass
