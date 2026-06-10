# Web — LLM Test Platform 前端

Vue 3 前端。基于 Vite、Element Plus 和 Pinia 构建。

## 快速开始

```bash
cd web
npm install
npm run dev           # http://localhost:5173
```

Vite 开发服务器将 `/api` 请求代理到 `http://localhost:3000`。请确保后端已启动。

## 脚本

| 命令 | 说明 |
|---------|-------------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |

## 架构

```
src/
├── api/               # Axios 客户端与各模块 API 函数
├── components/        # 可复用的 Vue 组件（布局、运行、任务）
├── composables/       # useSse.ts — SSE 事件流消费 Hook
├── data/              # templates.ts — 15+ 内置评测模板
├── router/            # Vue Router 配置
├── stores/            # Pinia Store（运行状态管理）
├── types/             # 与后端类型对应的 TypeScript 接口
└── views/             # 页面级组件（每路由一个）
```

## 路由

| 路径 | 视图 | 说明 |
|------|------|-------------|
| `/providers` | ProvidersView | 管理 LLM Provider 列表 |
| `/providers/new` | ProviderFormView | 添加新 Provider |
| `/providers/:id/edit` | ProviderFormView | 编辑 Provider |
| `/tasks` | TasksView | 评测任务列表 |
| `/tasks/new` | TaskCreateView | 创建任务（含模板选择器） |
| `/tasks/:id` | TaskDetailView | 任务详情、添加目标模型、运行、查看结果 |
| `/history` | HistoryView | 所有运行历史 |
| `/compare/:taskId?` | CompareView | 并排输出对比 |

## 技术栈

- **Vue 3** + 组合式 API（`<script setup>`）
- **Vite** 8 构建工具
- **Element Plus** UI 组件库
- **Pinia** 状态管理
- **Axios** HTTP 请求
- **Marked** Markdown 输出渲染

## SSE 流式消费

前端通过 `fetch` + `ReadableStream` 消费后端的 Server-Sent Events。实现见 `src/composables/useSse.ts`。事件按类型分发：

- `created` — TaskRun 记录已创建
- `delta` — 文本输出块
- `thinking` — 思考/推理链块
- `complete` — 运行成功完成
- `error` — 运行失败
- `done` — 当前任务所有运行结束
