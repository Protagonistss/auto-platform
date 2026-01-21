# Auto Platform

AI 驱动的自动化开发平台，包含智能代码生成和交互式聊天功能。

## 项目概述

Auto Platform 是一个基于 AI 的自动化开发平台，主要包含两个核心模块：

- **auto-backend**: 基于 FastAPI 和智谱 AI (GLM-4.7) 的智能代码生成服务
- **auto-chat**: 基于 React + Vite 的聊天交互界面

## 模块说明

### auto-backend

AI 驱动的 ORM 实体生成器，支持：

- 上传 JSON 配置文件自动生成 ORM 实体类
- 支持 MyBatis/Plus、Hibernate 等多种 ORM 框架
- 基于 FastAPI 构建 RESTful API
- 流式响应支持

**服务地址**: http://localhost:8000

**详细文档**: [auto-backend/README.md](auto-backend/README.md)

### auto-chat

现代化的聊天交互界面，支持：

- React 18 + TypeScript
- Vite 构建工具
- SSE 流式响应
- 会话管理
- 文件上传

**开发地址**: http://localhost:5173

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- uv (推荐) 或 pip

### 后端服务启动

```bash
cd auto-backend

# 安装依赖
uv sync

# 配置 API Key
cp .env.example .env

# 启动服务
uv run python -m builder.main
```

### 前端服务启动

```bash
cd auto-chat

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 项目结构

```
auto-platform/
├── auto-backend/      # 后端服务 (FastAPI + AI)
│   ├── builder/       # 核心源码
│   ├── uploads/       # 文件上传目录
│   └── xml_core/      # XML 核心处理
├── auto-chat/         # 前端界面 (React)
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── services/      # API 服务
│   │   └── types/         # TypeScript 类型
│   └── package.json
└── README.md
```

## 技术栈

### 后端
- FastAPI
- 智谱 AI (GLM-4.7)
- Pydantic
- Uvicorn

### 前端
- React 18
- TypeScript
- Vite
- Sass

## 开发指南

### 后端开发

```bash
cd auto-backend

# 添加依赖
uv add <package>

# 运行测试
uv run pytest

# 代码格式化
uv run ruff format .
```

### 前端开发

```bash
cd auto-chat

# 添加依赖
pnpm add <package>

# 类型检查
pnpm type-check

# 代码检查
pnpm lint

# 构建生产版本
pnpm build
```

## License

MIT License
