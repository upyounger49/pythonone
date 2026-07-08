"""Context management and summary generation for conversations."""

from sqlalchemy.orm import Session

from ..models.conversation import Conversation, Message
from .agent import get_agent
from .agent import get_title_agent


def estimate_tokens(text: str) -> int:
    """Rough token estimation: 1 Chinese char ≈ 1 token, 1 English char ≈ 0.25 token."""
    chinese_chars = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    total_chars = len(text)
    other_chars = total_chars - chinese_chars
    return int(chinese_chars + other_chars * 0.25)


def build_context(conversation: Conversation, db: Session) -> str:
    """Build full context for the agent from summary + recent messages."""
    parts = []

    if conversation.summary:
        parts.append(f"[历史对话摘要]\n{conversation.summary}\n")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    if messages:
        parts.append("[最近对话记录]")
        for msg in messages:
            role_name = "用户" if msg.role == "user" else "情感顾问"
            parts.append(f"{role_name}: {msg.content}")

    return "\n\n".join(parts)


def check_and_summarize(conversation: Conversation, db: Session) -> bool:
    """Check if summary threshold is reached and generate summary if needed.

    Returns True if a summary was generated, False otherwise.
    """
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    # Combine summary + all messages for estimation
    combined_text = ""
    if conversation.summary:
        combined_text += conversation.summary + "\n"

    for msg in messages:
        combined_text += msg.content + "\n"

    total_tokens = estimate_tokens(combined_text)
    threshold = int(conversation.context_limit * conversation.summary_trigger_ratio)

    if total_tokens <= threshold:
        return False

    # Generate summary
    recent_messages = messages[-20:] if len(messages) > 20 else messages[:]
    summary_prompt = _build_summary_prompt(conversation.summary, recent_messages)

    try:
        agent = get_agent()
        response = agent.run(summary_prompt)
        new_summary = response.content if hasattr(response, "content") else str(response)

        conversation.summary = new_summary

        # Delete old messages, keep last 20
        if len(messages) > 20:
            old_ids = [m.id for m in messages[:-20]]
            db.query(Message).filter(Message.id.in_(old_ids)).delete(synchronize_session=False)

        db.commit()
        return True
    except Exception:
        return False


def _build_summary_prompt(existing_summary: str | None, recent_messages: list[Message]) -> str:
    """Build prompt for summary generation."""
    conversation_text = "\n".join(
        f"{'用户' if m.role == 'user' else '情感顾问'}: {m.content}"
        for m in recent_messages
    )

    prompt = "请将以下对话内容压缩为一段简洁的摘要（不超过500字），保留关键信息：用户的核心问题或困扰、情感顾问给出的主要分析方向和建议。\n\n"

    if existing_summary:
        prompt += f"[之前的摘要]\n{existing_summary}\n\n"

    prompt += f"[最近的对话]\n{conversation_text}\n\n请输出摘要："
    return prompt


def generate_title(first_message: str) -> str:
    """Generate a conversation title from the first user message."""
    try:
        agent = get_title_agent()
        response = agent.run(f"请为这条消息生成一个简短标题（不超过15字）：{first_message}")
        title = response.content if hasattr(response, "content") else str(response)
        title = title.strip().strip("""'"。，！？、""")
        if not title:
            return "新对话"
        return title[:15]
    except Exception:
        return "新对话"
