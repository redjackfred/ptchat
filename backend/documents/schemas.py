import uuid
from datetime import datetime
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: uuid.UUID
    name: str
    file_type: str
    size_bytes: int | None
    status: str
    source: str
    file_path: str | None
    indexed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
