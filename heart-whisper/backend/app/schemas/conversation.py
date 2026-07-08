from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    first_message: str


class ConversationUpdate(BaseModel):
    title: str


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    user_id: int
    title: str
    summary: Optional[str] = None
    summary_trigger_ratio: float
    context_limit: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut] = []
