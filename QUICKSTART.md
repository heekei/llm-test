# 快速启动指南

## 前置条件

- Node.js 18+
- npm 或 pnpm

## 1. 安装依赖

```bash
npm install
```

## 2. 配置后端环境变量

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`，设置 `ENCRYPTION_KEY`：

```bash
# 生成随机密钥
openssl rand -hex 32
```

将生成的密钥填入 `.env` 文件：
```env
ENCRYPTION_KEY="你生成的密钥"
```

## 3. 初始化数据库

```bash
# 返回项目根目录
cd ..

# 运行数据库迁移
npm run prisma:migrate
```

按提示输入迁移名称（例如：`init`）。

## 4. 启动服务

### 开发模式

**方式一：两个终端**

```bash
# 终端 1: 后端
npm run dev:server

# 终端 2: 前端
npm run dev:web
```

**方式二：使用 concurrently（推荐）**

安装 concurrently：
```bash
npm install -D concurrently
```

在根 `package.json` 添加脚本：
```json
"dev": "concurrently \"npm:dev:server\" \"npm:dev:web\""
```

然后运行：
```bash
npm run dev
```

### 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api

## 5. 使用流程

1. **添加供应商**
   - 访问 http://localhost:5173
   - 点击左侧 "Providers"
   - 添加你的 API 供应商（OpenAI、Anthropic 等）

2. **创建任务**
   - 点击 "Tasks" → "+ New Task"
   - 填写评测任务信息

3. **运行评测**
   - 进入任务详情
   - 选择模型（支持从 API 查询或手动输入）
   - 点击 "Run" 开始执行

4. **查看结果**
   - 实时查看流式输出
   - 对结果评分
   - 使用 "Compare" 对比不同模型

## 常见问题

### 数据库未初始化
运行：`npm run prisma:migrate`

### API 连接失败
检查：
1. 供应商的 API 地址是否正确
2. API Key 是否有效
3. 网络连接是否正常

### 前端无法连接后端
确认后端已启动在 3000 端口，Vite 代理配置正确（已在 `web/vite.config.ts` 中配置）。

## 生产部署

```bash
# 1. 构建
npm run build

# 2. 启动后端
cd server
npm run start:prod

# 3. 前端静态文件
# web/dist 目录使用 nginx 或其他 Web 服务器托管
```
