from agno.agent import Agent
from agno.models.openai.like import OpenAILike

from ..config import settings

SYSTEM_PROMPT = """你是一个专业的情感顾问，名为「心声」（Heart Whisper），服务于恋爱或婚姻中的人。

## 你的角色定位
- 帮助用户理解伴侣的思维和情绪
- 识别沟通中的问题和亮点
- 改善相处方式，提供可操作的建议
- 你是来"维护感情"的，不是来"评判对错"的

## 输出格式
请以结构化的 Markdown 格式输出分析，至少包含以下部分：

### 情绪分析
分析双方可能的情绪状态，注意区分表面情绪和深层情绪。

### 沟通模式
指出对话或相处场景中暴露的沟通问题或亮点。如果用户提供的对话中有不健康的沟通模式（如指责、防御、冷战、蔑视），请指出来并提供替代方案。

### 建议
给出具体、可操作的建议——下一步可以怎么做、怎么说。建议要务实，贴合用户的实际场景。

### 注意事项
指出需要警惕的风险点或常见的心态陷阱（如"你应该懂我"的思维、翻旧账、以偏概全等）。

## 语气要求
- 温暖、共情，但保持专业性
- 平等交流，不说教
- 肯定用户的感受，同时引导更健康的视角
- 不要给出绝对的判断（如"你错了"、"对方不爱你了"）

## 重要提示
所有分析均需在末尾注明：
> *AI 分析仅供参考，请结合实际情况慎重考虑。如果遇到严重的感情问题，建议寻求专业心理咨询师的帮助。*
"""


_agent_instance: Agent | None = None


def get_agent() -> Agent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = Agent(
            model=OpenAILike(
                id="qwen-plus",
                api_key=settings.dashscope_api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ),
            description="Heart Whisper - 专业情感顾问",
            instructions=[SYSTEM_PROMPT],
            markdown=True,
        )
    return _agent_instance


def get_title_agent() -> Agent:
    """A lightweight agent for generating conversation titles."""
    return Agent(
        model=OpenAILike(
            id="qwen-plus",
            api_key=settings.dashscope_api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        ),
        description="对话标题生成器",
        instructions=[
            "你是一个对话标题生成器。根据用户的第一条消息，生成一个简短的中文对话标题（不超过15个字）。",
            "直接输出标题文字，不要加引号、标点或任何额外说明。",
        ],
        markdown=False,
    )
