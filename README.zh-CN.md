# LLM Test Platform

[English](README.md) | [模板清单](TEMPLATES.md) | [贡献指南](CONTRIBUTING.zh-CN.md)

一个自托管的 Web 平台，用于对比多个 LLM 模型在相同任务场景下的表现。定义评测任务，对不同模型运行测试，获取并排对比结果与 AI 自动评分。

## 特性

- **多 Provider 支持** — OpenAI、Anthropic 及任意 OpenAI 兼容 API
- **双评测模式** — 简单对话补全 + Agentic（ReAct 循环 + Docker 沙箱）
- **实时流式输出** — 基于 SSE 的流式传输，支持展示思考/推理链
- **AI 自动评分** — 5 维度自动评分（准确性、完整性、逻辑性、创造性、指令遵循），支持多裁判
- **并排对比** — 同一任务下不同模型输出横向对比
- **API Key 加密存储** — AES 加密落盘，仅在运行时解密
- **15+ 内置模板** — 开箱即用的评测提示词模板
- **Agent 追踪** — Agentic 运行的全量工具调用链和迭代历史

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 后端 | NestJS 11 + TypeScript |
| 数据库 | SQLite via Prisma 7 + libSQL |
| 前端 | Vue 3 + Vite + Element Plus |
| 状态管理 | Pinia |
| 运行环境 | Node.js 18+ |

## 截图

> TODO: 补充截图

- 任务列表与模板选择
- 流式输出评测过程
- 并排对比视图
- AI 评分面板

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+
- Docker（可选，用于 Agentic 沙箱模式）

### 安装

```bash
# 克隆并安装依赖
git clone https://github.com/heekei/llm-test.git
cd llm-test
npm install

# 配置
cd server
cp .env.example .env
# 编辑 .env — 设置 ENCRYPTION_KEY（生成命令：openssl rand -hex 32）

# 初始化数据库
cd ..
npm run prisma:migrate
npm run prisma:generate
```

### 启动

```bash
# 终端 1：后端服务（http://localhost:3000）
npm run dev:server

# 终端 2：前端页面（http://localhost:5173）
npm run dev:web
```

### 添加 Provider

1. 打开 http://localhost:5173/providers
2. 点击"添加 Provider"
3. 填写：名称、API Base URL、API Key、适配器类型（openai/anthropic）
4. 点击"拉取模型"获取该 Provider 下的可用模型列表

### 第一次评测

1. 进入 http://localhost:5173/tasks
2. 点击"新建任务"，选择模板或自行编写提示词
3. 进入任务详情页，添加目标模型，点击"运行"
4. 观看流式输出，完成后可使用 AI 评分进行自动评测

## 项目结构

```
llm-test/
├── server/                 # NestJS 后端
│   ├── src/
│   │   ├── agent/          # Agentic 模式：工具、Docker 沙箱、ReAct 循环
│   │   ├── common/         # EncryptionService（AES 密钥加解密）
│   │   ├── llm/            # 适配器模式（OpenAI & Anthropic）
│   │   ├── models/         # 从 Provider API 拉取并缓存模型列表
│   │   ├── prisma/         # 数据库服务
│   │   ├── providers/      # Provider 增删改查
│   │   ├── runs/           # 任务执行、SSE 流、评分
│   │   └── tasks/          # 任务增删改查、模板
│   └── prisma/             # Schema 与迁移
├── web/                    # Vue 3 前端
│   └── src/
│       ├── api/            # HTTP 客户端与各模块 API
│       ├── components/     # 可复用 Vue 组件
│       ├── composables/    # SSE 流消费 Hook
│       ├── data/           # 内置评测模板
│       ├── router/         # Vue Router 配置
│       ├── stores/         # Pinia 状态管理
│       └── views/          # 页面级组件
└── package.json            # npm workspaces 根
```

## API 概览

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| GET | `/api/providers` | 获取 Provider 列表 |
| POST | `/api/providers` | 添加 Provider |
| GET | `/api/models/:providerId` | 拉取并缓存 Provider 模型列表 |
| GET | `/api/tasks` | 获取任务列表 |
| POST | `/api/tasks` | 创建任务 |
| POST | `/api/tasks/:id/run` | 对目标模型运行任务（SSE 流） |
| GET | `/api/runs` | 获取所有运行历史 |
| PATCH | `/api/runs/:id/score` | 手动打分 |
| POST | `/api/runs/:id/ai-score` | 触发 AI 评分 |
| GET | `/api/tasks/:taskId/compare` | 获取某任务下的对比数据 |

## 架构

### 评测模式

- **简单模式** (`mode: "simple"`) — 单次对话补全，流式输出文本
- **Agentic 模式** (`mode: "agentic"`) — ReAct 循环，工具调用在 Docker 沙箱中执行
  - 内置工具：bash、python、read_file、write_file、web_request
  - 完整记录每次迭代、每个工具调用及其结果

### SSE 流式流程

```
POST /api/tasks/:id/run
  → 创建 TaskRun 记录
  → GET /api/runs/stream/:runId (SSE)
    → created → delta/thinking → complete/error → done
```

### AI 评分

调用裁判 LLM 对输出按 5 个权重维度打分，支持每轮运行多个裁判。评分以 JSON 数组存储。

### 加密

API Key 使用 AES-256-CBC 加密存储。密钥由 `ENCRYPTION_KEY` 环境变量派生，仅在执行 API 调用时解密。

## 路线图

- [ ] 基准数据集支持（预定义测试集）
- [ ] 批量评测与并发控制
- [ ] 结果导出 CSV/JSON
- [ ] 用户认证与多租户
- [ ] 更多内置 Agent 和工具
- [ ] PostgreSQL 支持
- [ ] 深色模式

## 开发指南

详见 [server/README.md](server/README.md) 和 [web/README.md](web/README.md)（英文）。

```bash
# 类型检查
npm run typecheck

# Lint（仅后端）
cd server && npm run lint

# 数据库 GUI
npm run prisma:studio
```

## 开源协议

MIT — 详见 [LICENSE](LICENSE)。
