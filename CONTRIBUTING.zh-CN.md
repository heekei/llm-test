# 贡献指南

[English](CONTRIBUTING.md)

感谢你对 LLM Test Platform 的关注！

## 起步

1. Fork 本仓库
2. 克隆你的 Fork：`git clone https://github.com/heekei/llm-test.git`
3. 安装依赖：`npm install`
4. 配置后端（见[快速开始](README.zh-CN.md#快速开始)）
5. 创建分支：`git checkout -b feature/my-feature`

## 开发工作流

```bash
# 提交前做类型检查
npm run typecheck

# 运行 Lint（仅后端）
cd server && npm run lint

# 运行测试（仅后端）
cd server && npm run test
cd server && npm run test:e2e
```

## 提交信息格式

请遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(server): 添加批量评测接口
fix(web): 修复对比视图中分数显示错误
docs: 更新 API 文档
```

## 代码风格

- 尽可能使用 TypeScript strict 模式
- ESLint + Prettier 统一格式化
- 遵循现有模式（LLM 集成的适配器模式、class-validator 做 DTO 校验）

## 项目结构

完整目录结构见 [README.zh-CN.md](README.zh-CN.md#项目结构)。

## 添加新 LLM Provider

1. 在 `server/src/llm/adapters/` 中新建适配器，实现 `LlmAdapter` 接口
2. 在 `server/src/llm/factories/adapter.factory.ts` 中注册
3. 在 `server/src/providers/dto/provider.dto.ts` 中将适配器类型加入 `adapterType` 校验

## 提交 Issue

请包含以下信息：
- 复现步骤
- 预期行为 vs 实际行为
- 运行环境（操作系统、Node.js 版本）
- 相关日志或截图
