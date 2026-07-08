import asyncio
import json
from datetime import datetime, timezone
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.conversation import Conversation, Message
from ..models.user import User
from ..schemas.chat import ChatRequest
from ..schemas.conversation import ConversationCreate, ConversationOut
from ..services.agent import get_agent
from ..services.memory import build_context, check_and_summarize, generate_title

router = APIRouter(prefix="/api/conversations", tags=["chat"])


@router.post("", response_model=ConversationOut)
def create_conversation(
    req: ConversationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Generate title or use placeholder
    if req.title and req.title.strip():
        title = req.title.strip()
    else:
        title = generate_title(req.first_message)

    # 2. Create conversation
    now = datetime.now(timezone.utc)
    conversation = Conversation(
        user_id=user.id,
        title=title,
        created_at=now,
        updated_at=now,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    # 3. Store user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.first_message,
        created_at=now,
    )
    db.add(user_msg)
    db.commit()

    conversation.updated_at = now
    db.commit()
    db.refresh(conversation)

    return conversation


@router.post("/{conversation_id}/chat")
async def chat(
    conversation_id: int,
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Verify conversation belongs to user
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # 2. Store user message
    now = datetime.now(timezone.utc)
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.content,
        created_at=now,
    )
    db.add(user_msg)
    db.commit()

    conversation.updated_at = now
    db.commit()

    # 3. Check if summary needed
    check_and_summarize(conversation, db)
    db.refresh(conversation)

    # 4. Build context
    context = build_context(conversation, db)

    async def event_stream():
        full_response = StringIO()
        try:
            agent = get_agent()

            def run_agent():
                return agent.run(context, stream=True)

            response_stream = await asyncio.to_thread(run_agent)

            for chunk in response_stream:
                if hasattr(chunk, "content") and chunk.content:
                    full_response.write(chunk.content)
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        # Store assistant message
        assistant_content = full_response.getvalue()
        if assistant_content.strip():
            assistant_msg = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_content,
            )
            db.add(assistant_msg)
            db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
