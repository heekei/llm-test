# LLM Test Platform

模型评测 Web 平台，用于测试不同 LLM 模型在相同任务场景下的表现。

## 功能特性

- **供应商管理**：添加模型供应商（API 地址、API Key、适配器类型）
- **模型缓存**：一键从供应商 API 获取模型列表并持久化存储
- **任务模板**：内置 15+ 精选评测模板，覆盖逻辑推理、代码编程、创意写作等场景
- **任务管理**：创建评测任务（Prompt、System Prompt、参数配置）
- **模型选择**：
  - 从已缓存模型选择（按供应商分组）
  - 手动输入模型 ID
- **并行执行**：支持同时对多个模型运行相同任务
- **实时流式输出**：SSE 流式显示每个模型的响应
- **结果对比**：对比不同模型的输出、延迟、评分
- **历史记录**：查看所有运行历史

## 技术栈

**后端**
- NestJS + TypeScript
- Prisma 7 (SQLite)
- RxJS (流式处理)
- OpenAI / Anthropic API 适配器

**前端**
- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- Axios (HTTP 客户端)
- Marked (Markdown 渲染)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

后端配置：

```bash
cd server
cp .env.example .env
# 编辑 .env，设置 ENCRYPTION_KEY（用于加密 API Key）
```

生成加密密钥：
```bash
openssl rand -hex 32
```

### 3. 初始化数据库

```bash
cd server
npm run prisma:migrate
```

### 4. 启动服务

**开发模式：**

```bash
# 终端 1: 启动后端 (http://localhost:3000)
cd server
npm run start:dev

# 终端 2: 启动前端 (http://localhost:5173)
cd web
npm run dev
```

**生产模式：**

```bash
# 构建
npm run build

# 启动后端
cd server
npm run start:prod

# 前端静态文件在 web/dist，使用 nginx 或其他服务器托管
```

### 5. 访问应用

打开浏览器访问：http://localhost:5173

## 使用流程

1. **添加供应商**
   - 进入 "Providers" 页面
   - 点击 "+ New Provider"
   - 填写供应商信息（名称、API 地址、API Key、适配器类型）
   - 示例：
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`

2. **获取模型列表**
   - 在供应商列表中，点击每个供应商的 "Fetch Models" 按钮
   - 系统会从供应商 API 查询可用模型并缓存到数据库
   - 此操作只需执行一次，模型列表会持久保存

3. **创建任务**
   - 进入 "Tasks" 页面
   - 点击 "+ New Task"
   - **方式一：从模板创建**
     - 点击 "📋 从模板创建" 按钮
     - 浏览 15+ 内置评测模板，覆盖：
       - 逻辑推理（25 匹马问题、鸡兔同笼、海盗分金币等）
       - 代码编程（算法实现、Debug、系统设计）
       - 创意写作（科幻短篇、产品文案）
       - 知识问答（历史、科学）
       - 指令遵循（结构化输出、角色扮演）
       - 安全测试（拒绝有害请求、伦理推理）
     - 点击模板自动填充表单
   - **方式二：手动创建**
     - 填写任务信息（标题、Prompt、可选的 System Prompt 和参数）
   - 可选：选择模型目标（也可以稍后在任务详情页添加）
   - 保存后进入任务详情页

4. **运行任务**
   - 在任务详情页选择模型：
     - **从已缓存模型选择**：下拉列表显示所有已获取的模型（按供应商分组）
     - **手动输入模型 ID**：如果列表中没有想要的模型，可以手动输入
   - 可添加多个目标模型
   - 点击 "Run" 开始执行
   - 实时查看每个模型的流式输出

5. **对比和评分**
   - 运行完成后可对每个结果评分（1-5 星）
   - 点击 "Compare" 查看所有运行结果的并排对比
   - 在 "History" 页面查看所有历史记录

## API 适配器

当前支持的适配器：

- **openai**: OpenAI API 兼容接口（OpenAI、Azure OpenAI、兼容服务）
- **anthropic**: Anthropic Claude API

适配器会自动处理：
- 模型列表查询（支持 API 回退）
- 流式输出解析
- 错误处理

## 开发

```bash
# 类型检查
npm run typecheck

# 代码格式化
npm run format

# 数据库迁移
cd server
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate
```

## 项目结构

```
llm-test/
├── server/          # NestJS 后端
│   ├── prisma/      # 数据库 Schema 和迁移
│   ├── src/
│   │   ├── llm/     # LLM 适配器
│   │   ├── providers/ # 供应商模块
│   │   ├── tasks/   # 任务模块
│   │   └── runs/    # 运行记录模块
│   └── ...
├── web/             # Vue 3 前端
│   ├── src/
│   │   ├── api/     # API 客户端
│   │   ├── components/ # Vue 组件
│   │   ├── views/   # 页面视图
│   │   └── ...
│   └── ...
└── package.json     # Workspace 根配置
```

## License

MIT
