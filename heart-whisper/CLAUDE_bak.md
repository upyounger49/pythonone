## 项目概述

heart-whisper 是一个基于 AI 的情感顾问 Web 应用，帮助恋爱/婚姻中的人理解伴侣、改善沟通、经营感情。用户注册登录后，创建对话，发送文字描述（如聊天记录、相处场景），AI 情感顾问以流式方式输出结构化的分析报告（情绪分析、沟通模式、建议、注意事项）。所有对话持久化，上下文达到 80% 阈值时自动生成摘要压缩。

- **用户角色**：恋爱/婚姻中的男女，需要注册/登录
- **v1.0 范围**：纯文字交互，不支持文件上传/截图 OCR
- **部署**：最终部署到 Linux 云服务器，用户通过域名访问

## 技术栈

| 层        | 选型                                   |
| -------- | ------------------------------------ |
| 后端语言     | Python 3.11+                         |
| Web 框架   | FastAPI（异步，SSE 流式）                   |
| Agent 框架 | agno                                 |
| LLM      | 通义千问 Qwen（阿里云 DashScope，OpenAI 兼容接口） |
| 关系数据库    | SQLite（SQLAlchemy ORM）               |
| 认证       | JWT（python-jose）                     |
| 前端框架     | React 18 + TypeScript                |
| 构建工具     | Vite                                 |
| CSS      | Tailwind CSS                         |
| 容器化      | Docker + docker-compose              |
| 反代       | Nginx                                |

## 项目结构

```
heart-whisper/
├── CLAUDE.md                  # 本文件
├── .gitignore
├── docker-compose.yml         # 一键编排：后端 + Nginx
├── nginx.conf                 # Nginx 配置（反代 + 静态文件）
│
├── backend/
│   ├── Dockerfile             # 后端镜像
│   ├── requirements.txt       # Python 依赖
│   ├── .env.example           # 环境变量模板（DASHSCOPE_API_KEY, JWT_SECRET 等）
│   └── app/
│       ├── __init__.py
│       ├── main.py            # FastAPI 应用入口，挂载路由，CORS 配置
│       ├── config.py          # 从 .env 读取配置，提供全局 Settings 对象
│       ├── database.py        # SQLAlchemy engine + SessionLocal + Base
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py        # User 表（id, username, hashed_password, created_at）
│       │   └── conversation.py # Conversation 表 + Message 表
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py        # Pydantic: RegisterRequest, LoginRequest, TokenResponse
│       │   ├── conversation.py # Pydantic: ConversationCreate, ConversationOut, MessageOut
│       │   └── chat.py        # Pydantic: ChatRequest
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py        # /api/auth/register, /api/auth/login, /api/auth/me
│       │   ├── conversations.py # /api/conversations CRUD
│       │   └── chat.py        # /api/conversations/{id}/chat (SSE 流式)
│       ├── services/
│       │   ├── __init__.py
│       │   ├── agent.py       # agno Agent 初始化 + Qwen 调用
│       │   └── memory.py      # 上下文组装 + 摘要生成触发
│       └── middleware/
│           └── auth.py        # JWT 验证 FastAPI 依赖注入（get_current_user）
│
└── frontend/
    ├── index.html             # Vite 入口 HTML
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts         # 开发时 proxy 后端 8000 端口
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.tsx           # ReactDOM.createRoot
        ├── App.tsx            # 顶层组件：未登录 → LoginPage，已登录 → ChatPage
        ├── api/
        │   └── client.ts      # fetch 封装（自动带 JWT），SSE 连接工厂
        ├── pages/
        │   ├── LoginPage.tsx  # 登录/注册表单（Tab 切换）
        │   └── ChatPage.tsx   # 聊天主布局：Sidebar + ChatWindow + MessageInput
        ├── components/
        │   ├── Sidebar.tsx       # 对话列表 + 新建对话按钮 + 删除
        │   ├── ChatWindow.tsx    # 当前对话的消息渲染 + 流式追加
        │   ├── MessageInput.tsx  # 输入框（Enter 发送，Shift+Enter 换行）
        │   └── NewChatDialog.tsx # 新建对话弹窗（可选手动标题 + 首条消息）
        └── types/
            └── index.ts          # Conversation, Message, User 等 TypeScript 类型
```

## 数据模型

### users 表

| 字段              | 类型                   | 说明          |
| --------------- | -------------------- | ----------- |
| id              | INTEGER PK           | 自增主键        |
| username        | TEXT UNIQUE NOT NULL | 用户名         |
| hashed_password | TEXT NOT NULL        | bcrypt 哈希密码 |
| created_at      | DATETIME             | 创建时间        |

### conversations 表

| 字段                    | 类型                    | 说明             |
| --------------------- | --------------------- | -------------- |
| id                    | INTEGER PK            | 自增主键           |
| user_id               | INTEGER FK → users.id | 归属用户           |
| title                 | TEXT NOT NULL         | AI 根据首条消息自动生成  |
| summary               | TEXT NULL             | 上下文压缩摘要        |
| summary_trigger_ratio | REAL DEFAULT 0.8      | 触发摘要的上下文占比     |
| context_limit         | INTEGER DEFAULT 10000 | 上下文 token 估算上限 |
| created_at            | DATETIME              | 创建时间           |
| updated_at            | DATETIME              | 最后更新时间         |

### messages 表

| 字段              | 类型                            | 说明                   |
| --------------- | ----------------------------- | -------------------- |
| id              | INTEGER PK                    | 自增主键                 |
| conversation_id | INTEGER FK → conversations.id | 所属对话                 |
| role            | TEXT NOT NULL                 | "user" 或 "assistant" |
| content         | TEXT NOT NULL                 | 消息内容                 |
| created_at      | DATETIME                      | 创建时间                 |

## 上下文管理机制

所有对话都是长期记忆对话。上下文组装流程：

1. 读取 `conversation.summary`（如果有）
2. 从 messages 表读取该对话所有消息（按时间升序）
3. 粗略估算 token 数（中文 1 字符 ≈ 1 token，英文 1 字符 ≈ 0.25 token）
4. 若估算 token > `context_limit * summary_trigger_ratio`（默认 80%）：
   - 调用 LLM 重新生成摘要（合并旧摘要 + 现有消息）
   - 存入 `conversation.summary`，清空旧消息（保留最近 20 条）
5. 构建发给 agno 的 context：system_prompt + summary + recent_messages

**摘要触发时机**：每次 chat 请求前同步检查，满足阈值则先摘要后回复（摘要用一个独立的 LLM 调用完成，不等同于对用户的回复）。

## API 设计

| 方法     | 路径                           | 说明                                     | 认证  |
| ------ | ---------------------------- | -------------------------------------- | --- |
| POST   | /api/auth/register           | 注册新用户                                  | 否   |
| POST   | /api/auth/login              | 登录，返回 `{ access_token, token_type }`   | 否   |
| GET    | /api/auth/me                 | 当前用户信息                                 | 是   |
| GET    | /api/conversations           | 当前用户对话列表（按 updated_at 倒序）              | 是   |
| POST   | /api/conversations           | 创建对话，body: `{ title?, first_message }` | 是   |
| GET    | /api/conversations/{id}      | 对话详情 + 消息列表                            | 是   |
| DELETE | /api/conversations/{id}      | 删除对话及其所有消息                             | 是   |
| PATCH  | /api/conversations/{id}      | 更新 title                               | 是   |
| POST   | /api/conversations/{id}/chat | 发消息，SSE 流式返回                           | 是   |

### Chat SSE 流式格式

`POST /api/conversations/{id}/chat` 返回 `text/event-stream`：

```
data: {"type": "token", "content": "从你们的"}
data: {"type": "token", "content": "对话来看..."}
...
data: {"type": "done"}
```

## Agent System Prompt

agent 的角色定位（在 `services/agent.py` 中定义）：

- 你是一个专业的情感顾问，服务于恋爱或婚姻中的人
- 你的任务是帮助用户理解伴侣的思维和情绪、识别沟通中的问题、改善相处方式
- 你是来"维护感情"的，不是来"评判对错"的
- 输出以结构化的 Markdown 格式呈现，至少包含：
  - `### 情绪分析`：双方可能的情绪状态
  - `### 沟通模式`：对话中暴露的沟通问题或亮点
  - `### 建议`：具体、可操作的建议（下一步可以怎么做、怎么说）
  - `### 注意事项`：需要警惕的风险点或心态陷阱
- 语气温暖、专业、不说教
- 所有建议均标注"AI 分析仅供参考，请结合实际情况慎重考虑"

## 快速启动（本地开发）

### 后端

```bash
cd heart-whisper/backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # 编辑 .env，填入 DASHSCOPE_API_KEY 和 JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd heart-whisper/frontend
pnpm install
pnpm run dev                  # 默认 http://localhost:5173
```

## 技术约定

### Python 后端

- **Web**：FastAPI + Pydantic schemas（请求/响应用 Pydantic 模型验证）
- **异步**：所有路由用 `async def`，数据库操作用同步 SQLAlchemy Session
- **数据库**：SQLAlchemy ORM，不引入 Alembic 迁移，直接用 `Base.metadata.create_all` 建表
- **LLM 调用**：agno `agent.run()` 在同步线程中执行，聊天端点用 `asyncio.to_thread` 包装
- **密码**：bcrypt 哈希（passlib）

### React 前端

- 函数组件 + Hooks，所有组件用 TypeScript
- Props 用 `interface` 定义
- 状态管理：`useState` / `useEffect`，不引入 Redux
- 一个组件一个文件，组件名 PascalCase
- HTTP 请求用原生 `fetch`，不装 axios
- SSE 流式接收用 fetch + ReadableStream 手动解析
- 必须使用 pnpm 作为包管理器

## 编码规范

- **Python**：PEP 8，类型注解，docstring 用英文，所有代码都需要中文注释
- **React**：一个组件一个文件，Props 用 `interface` 定义
- **文件命名**：Python 用 `snake_case`，React 组件用 `PascalCase`
- **配置文件**：所有敏感信息放 `.env`，不写死在代码里，不提交到 git

## 常见陷阱 / 注意事项

- **agno + Qwen 兼容性**：通义千问通过 `OpenAIChat` 接入，`base_url` 设为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **agno stream 模式**：`agent.run(stream=True)` 是同步生成器，在 FastAPI async 端点中必须用 `asyncio.to_thread()` 包装
- **摘要阻塞 chat 请求**：如果生成摘要耗时过久，chat 请求会被阻塞。后续可改为后台任务
- **标题生成阻塞对话创建**：创建对话时同步等待 LLM 生成标题，如果超时应有 fallback
- **端口冲突**：Vite 开发服务器 5173，后端 8000
- **JWT 存储**：前端 JWT 存 `localStorage`，每次请求前从 localStorage 读取并添加到 Authorization header
- **不要提交 `.env` 文件到 Git**：`.gitignore` 中已配置
