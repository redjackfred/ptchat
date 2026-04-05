from fastapi import APIRouter
from pydantic import BaseModel
from settings.service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])
_svc = SettingsService()


class SettingsPatch(BaseModel):
    theme: str | None = None
    ollama_endpoint: str | None = None
    watched_folders: list[str] | None = None


class ApiKeyBody(BaseModel):
    key: str


@router.get("")
def get_settings():
    return _svc.get()


@router.patch("")
def update_settings(patch: SettingsPatch):
    return _svc.update(patch.model_dump(exclude_none=True))


@router.get("/providers")
def list_providers():
    """Returns all providers with whether their API key is configured."""
    from llm.registry import registry
    providers = []
    for name in registry.list_providers():
        p = registry.get(name)
        has_key = name == "ollama" or bool(_svc.get_api_key(name))
        providers.append({
            "name": name,
            "models": p.available_models(),
            "supports_vision": p.supports_vision(),
            "has_key": has_key,
        })
    return providers


@router.put("/api-keys/{provider}")
def set_api_key(provider: str, body: ApiKeyBody):
    _svc.set_api_key(provider, body.key)
    return {"ok": True}


@router.delete("/api-keys/{provider}")
def delete_api_key(provider: str):
    _svc.delete_api_key(provider)
    return {"ok": True}
