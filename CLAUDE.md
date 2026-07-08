# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 仓库概述

这是一个 monorepo。当前唯一的项目是 `heart-whisper/`，一个全栈 AI 情感顾问聊天应用（FastAPI + React）。

## 开发命令

### 后端（heart-whisper）

```bash
cd heart-whisper/backend
pip install -r requirements.txt          # 仅首次
cp .env.example .env                     # 编辑 .env，填入 DashScope API Key
uvicorn app.main:app --reload --port 8000
```

另有自定义斜杠命令可用（见下方）。

### 前端（heart-whisper）

```bash
cd heart-whisper/frontend
pnpm install              # 仅首次
pnpm run dev              # http://localhost:5173
pnpm run build            # 生产构建 → dist/
pnpm lint
```

### 自定义斜杠命令

定义在 `.claude/commands/` 中，`$1` 为项目名称参数：

| 命令                 | 作用                                   |
| ------------------ | ------------------------------------ |
| `/startbk <项目名>`   | 后台启动后端（uvicorn --reload --port 8000） |
| `/startft <项目名>`   | 后台启动前端（pnpm dev）                     |
| `/restartbk <项目名>` | 杀掉占用 8000 端口的进程，重新启动后端               |

### Docker 部署

```bash
docker-compose -f heart-whisper/docker-compose.yml build
docker-compose -f heart-whisper/docker-compose.yml up -d
```

## 架构（heart-whisper）

### 后端（FastAPI + agno + SQLite）

- **`app/main.py`**：FastAPI 入口，使用 `create_app()` 工厂函数。注册 CORS（origin: `localhost:5173`），挂载三个路由，启动时通过 `Base.metadata.create_all` 自动建表。
- **`app/config.py`**：`pydantic_settings.BaseSettings` 从 `.env` 读取配置。字段：`dashscope_api_key`、`jwt_secret`、`jwt_algorithm`、`jwt_expire_minutes`、`database_url`。
- **`app/database.py`**：SQLAlchemy 配置，`check_same_thread=False`（SQLite + FastAPI 必需）。`get_db()` 生成器供 `Depends` 使用。
- **`app/models/`**：三张表——`User`（bcrypt 哈希密码）、`Conversation`（含 `title`、`summary`、`summary_trigger_ratio`、`context_limit`）、`Message`（role + content）。
- **`app/api/chat.py`**：SSE 流式聊天端点。每次请求流程：
  1. 保存用户消息到数据库
  2. 调用 `check_and_summarize()`——若估算 token 超过 `context_limit` 的 80%，则调用 LLM 重新生成摘要，删除旧消息保留最近 20 条，存储新摘要
  3. 构建上下文（摘要 + 最近消息）
  4. 通过 `asyncio.to_thread()` 运行 `agno.Agent.run()`，将 token 以 SSE `data:` 行流式输出
  5. 将完整助手回复保存到数据库
- **`app/services/agent.py`**：两个 Agent。均使用 `agno.models.openai.like.OpenAILike`（**不是** `OpenAIChat`），因为 `OpenAIChat` 会将 `system` 角色映射为 `developer`，DashScope Qwen 不支持该角色。
  - `get_agent()`：单例，system prompt 定义了「心声」情感顾问角色，输出结构化 Markdown（情绪分析、沟通模式、建议、注意事项）。
  - `get_title_agent()`：生成对话标题（最长 15 个汉字）。
- **`app/services/memory.py`**：Token 估算（1 中文字符 ≈ 1 token，1 ASCII 字符 ≈ 0.25 token）。当估算 token > `context_limit * summary_trigger_ratio` 时触发 `check_and_summarize()`。`build_context()` 将摘要和消息组合为 prompt 上下文。
- **`app/middleware/auth.py`**：`get_current_user` 依赖注入——从 Authorization header 提取 Bearer token，解码 JWT，查找用户。任何失败均返回 401。

### 后端分层架构

#### 四层架构

| 层              | 目录              | 职责                                      |
| -------------- | --------------- | --------------------------------------- |
| 路由层 (api)      | `app/api/`      | 请求参数校验、调用服务层、构造 ApiResponse 响应、SSE 流式输出 |
| 服务层 (services) | `app/services/` | 核心业务逻辑：Agent 调用、上下文管理、对话 CRUD、用户管理      |
| 数据模型层 (models) | `app/models/`   | ORM 表定义（纯表结构，无业务逻辑）                     |
| 展示层 (schemas)  | `app/schemas/`  | Pydantic 模型：请求校验、响应序列化、公共响应包装           |

#### 单向依赖规则

```
api/ → services/ → models/
  ↓
schemas/  (被 api/ 和 services/ 共同依赖，schemas 自身无外部依赖)
```

#### 禁止的跨层调用

- **api 层禁止直接操作 ORM session** — 不允许 `db.query(User)` 或 `db.add(x)` / `db.commit()`
- **api 层禁止直接导入 ORM 模型** — 不能 `from ..models.user import User`
- **services 层禁止导入 FastAPI 依赖** — 不能依赖 `Depends`、`HTTPException`、`Request`
- **schemas 层禁止依赖任何其他层** — 只能使用 Pydantic + Python 标准类型

#### v0.1 渐进式改造策略

- 新增端点严格按规范编写
- 修改现有端点时，若改动超过 5 行，顺带调整为规范写法
- Bug 修复最小改动，不强求重构
- 旧代码维持现状

### 前端（React 18 + Vite 6 + Tailwind 3）

- **`App.tsx`**：认证守卫。挂载时通过 `GET /api/auth/me` 校验存储的 JWT。根据登录状态渲染 `LoginPage` 或 `ChatPage`。
- **`api/client.ts`**：`apiFetch<T>()` 封装，自动注入 JWT header，401 时清空 token 并刷新页面。`connectSSE()` 使用手动 `ReadableStream` 解析（因为聊天端点是 POST 请求，不能用 EventSource）。
- **`pages/ChatPage.tsx`**：中央状态管理——对话列表、当前对话 ID、消息数组、流式文本。在一次流程中处理新建对话 + 首条消息发送。
- **`components/ChatWindow.tsx`**：自定义 `renderMarkdown()`，支持标题、加粗、斜体、列表、引用块。自动滚动。使用 `dangerouslySetInnerHTML`。
- **`components/Sidebar.tsx`**：双击删除对话（显示「确认删除」）。
- **`components/MessageInput.tsx`**：Enter 发送，Shift+Enter 换行。

### 聊天消息数据流

```
用户输入 → ChatPage.handleSend()
  → apiFetch POST /api/conversations/{id}/chat
  → 后端：保存用户消息 → 检查摘要 → 构建上下文 → agent.run() 在子线程中执行 → SSE 流
  → 前端：SSE 解析 → onToken 更新 streamingText → onDone 保存助手消息
  → ChatWindow 渲染 Markdown
```

# 

### 前端适配要点

- `api/client.ts`：`data.detail` 变为 `{code, message}` 对象，需更新错误解析逻辑
- 响应数据取 `.data` 字段
- `types/index.ts`：新增 `ApiResponse<T>` 和 `PaginatedData<T>` 泛型接口

## 工具配置

VS Code 设置在文件浏览器中隐藏 Python 产物（`.venv`、`__pycache__`、`.pytest_cache`、`.mypy_cache`），并将终端编码设为 UTF-8。

`.claude/settings.local.json` 中的 Claude Code 权限允许 `pnpm`、`uvicorn`、`taskkill` 和 `powershell` 命令。

## Python开发规范

- 严格依照 /doc/pythonspec/pythonSpec.md
