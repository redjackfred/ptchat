from pydantic_settings import BaseSettings
from pathlib import Path


class Config(BaseSettings):
    database_url: str
    uploads_dir: Path = Path("./uploads")
    settings_file: Path = Path("~/.ptchat/settings.json")

    model_config = {"env_file": ".env"}


config = Config()
