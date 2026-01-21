#!/usr/bin/env python3
"""
使用多 worker 模式启动后端服务
这样可以避免流式请求阻塞其他请求
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    from builder.main import app
    import uvicorn
    from builder.config import settings

    print("=" * 50)
    print("🚀 启动 Auto-Builder 后端 (多 Worker 模式)")
    print("=" * 50)
    print(f"Host: {settings.host}")
    print(f"Port: {settings.port}")
    print(f"Workers: 4")
    print("注意: 多 worker 模式不支持代码热重载")
    print("=" * 50)

    uvicorn.run(
        "builder.main:app",
        host=settings.host,
        port=settings.port,
        workers=4,
        log_level="info"
    )
