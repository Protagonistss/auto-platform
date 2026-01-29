# Repository Guidelines

## 项目结构与模块组织
- `auto-backend/`：FastAPI 后端服务，核心代码在 `auto-backend/builder/`（`api/`、`services/`、`models/`、`prompts/`）。
- 测试在 `auto-backend/tests/`；运行时文件在 `auto-backend/uploads/`（不要提交生成文件）。
- `auto-chat/`：React + Vite 前端，源码在 `auto-chat/src/`（`components/`、`hooks/`、`services/`、`types/`）。
- 样式使用 CSS Modules，文件与组件同级，例如 `ChatInterface.module.css`。

## 构建、测试与开发命令
- 后端依赖：`cd auto-backend` → `uv sync`
- 后端启动：`uv run python -m builder.main`（或 `uv run uvicorn builder.main:app --reload`）
- 后端测试：`uv run pytest`
- 后端格式化：`uv run ruff format .`
- 前端依赖：`cd auto-chat` → `pnpm install`
- 前端启动：`pnpm dev`；构建：`pnpm build`；预览：`pnpm preview`
- 前端测试：`pnpm test:unit`（Vitest）
- 前端检查/格式化：`pnpm lint`、`pnpm format`

## 编码风格与命名约定
- TypeScript/React：组件 `PascalCase`，hooks 使用 `useX`，变量 `camelCase`。
- CSS Modules：类名 `camelCase`，通过 `styles.*` 引用。
- Python：遵循 Ruff 格式化，尽量保留类型标注。

## 测试指南
- 后端：pytest，文件名 `test_*.py`，放在 `auto-backend/tests/`。
- 前端：Vitest，建议 `*.test.ts(x)`，尽量靠近功能模块。
- PR 中说明执行过的测试命令。

## 提交与 PR 指南
- 提交信息使用 `type(scope): summary` 风格。
  - 例：`feat(auto-chat): ...`、`fix(build-logs): ...`、`chore: ...`、`refactor(auto-chat): ...`
- PR 需包含：变更说明、测试结果；UI 变更请附截图。
- 如有对应 Issue，请在 PR 中关联。

## 配置与安全
- 后端配置：`auto-backend/.env`，从 `.env.example` 复制。
- 不要提交 API Key（如 `ZHIPU_API_KEY`）或 `uploads/` 生成文件。
