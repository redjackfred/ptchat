import uuid
from datetime import datetime
from pydantic import BaseModel


class SessionCreate(BaseModel):
    name: str
    llm_provider: str
    llm_model: str


class SessionOut(BaseModel):
    id: uuid.UUID
    name: str
    llm_provider: str
    llm_model: str
    created_at: datetime
    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    content: str
