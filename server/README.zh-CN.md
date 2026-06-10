# Server — LLM Test Platform 后端

NestJS 后端，为 LLM Test Platform 提供 REST API，管理 Provider、任务、评测运行和 AI 评分。

## 快速开始

```bash
cd server
cp .env.example .env   # 生成 ENCRYPTION_KEY：openssl rand -hex 32
npm install
npm run prisma:migrate
npm run prisma:generate
npm run start:dev       # http://localhost:3000
```

## 脚本

| 命令 | 说明 |
|---------|-------------|
| `npm run start:dev` | 开发模式（热重载） |
| `npm run build` | 生产构建 |
| `npm run test` | 运行单元测试（Jest） |
| `npm run test:e2e` | 运行端到端测试 |
| `npm run test:cov` | 测试覆盖率报告 |
| `npm run lint` | Lint + 自动修复（ESLint） |
| `npm run format` | 格式化（Prettier） |
| `npm run prisma:generate` | 生成 Prisma 客户端 |
| `npm run prisma:migrate` | 执行数据库迁移 |
| `npm run prisma:studio` | 打开 Prisma Studio 可视化工具 |

## 架构

```
src/
├── agent/              # Agentic 模式：工具、Docker 沙箱、ReAct 循环
├── common/             # EncryptionService（AES 加解密 API Key）
├── llm/
│   ├── adapters/       # LlmAdapter 接口 + OpenAI 与 Anthropic 实现
│   └── factories/      # 适配器工厂（按类型字符串获取对应适配器）
├── models/             # 从 Provider API 拉取模型列表，缓存至数据库
├── prisma/             # PrismaService（数据库客户端单例）
├── providers/          # Provider 增删改查
├── runs/               # 任务执行、SSE 流输出、手动 + AI 评分
└── tasks/              # 任务增删改查，模板支持
```

## 核心概念

### 适配器模式

`LlmAdapter` 接口为不同 LLM API 提供统一抽象：

- `listModels()` — 拉取 Provider 下可用模型 ID 列表
- `streamChat()` — 流式单次对话补全（SSE）
- `chat()` — 非流式对话补全
- `agentTurn()` — Agentic 回合（支持工具调用）
- `streamAgentTurn()` — 流式 Agentic 回合

实现类：`OpenAiAdapter`、`AnthropicAdapter`。

### SSE 流式输出

评测运行通过 Server-Sent Events 流式推送结果。流程如下：

1. `POST /api/tasks/:id/run` 创建 `TaskRun` 记录
2. SSE 事件依次发送：`created` → `delta`/`thinking` → `complete`/`error` → `done`

### AI 评分

使用裁判 LLM 对输出按 5 个维度进行评分：

| 维度 | 权重 |
|-----------|--------|
| 准确性 | 25% |
| 完整性 | 20% |
| 逻辑性 | 20% |
| 创造性 | 15% |
| 指令遵循 | 20% |

结果以 JSON 数组存储 — 支持每轮运行多个裁判。

### 加密

API Key 使用 AES-256-CBC 加密存储，由 `EncryptionService` 管理。仅在执行 API 调用时解密。

### Agentic 模式

当 `mode: "agentic"` 时，任务通过 ReAct 循环运行：

1. 将对话历史 + 工具定义发送给 LLM
2. 解析响应中的 text 和 tool_use 块
3. 在 Docker 沙箱中执行工具调用（或本地回退）
4. 将工具结果作为 user 消息反馈给模型
5. 重复以上步骤，直到无更多工具调用或达到最大迭代次数

内置工具：`bash`、`python`、`read_file`、`write_file`、`web_request`。

## 数据库

SQLite + Prisma + libSQL 适配器。完整 Schema 见 `prisma/schema.prisma`。

核心模型：
- **Provider** — LLM API 配置（地址、密钥、适配器类型）
- **Model** — 每个 Provider 的缓存模型列表
- **Task** — 评测任务定义（提示词、参数、模式）
- **TaskRun** — 单次评测运行结果（输出、Token 数、延迟、评分）

## 环境变量

| 变量 | 必填 | 说明 |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | 是 | 64 位 hex 字符串，用于 AES 密钥派生 |
| `PORT` | 否 | 服务端口（默认：3000） |
| `DATABASE_URL` | 否 | SQLite 文件路径（默认：`file:./dev.db`） |
