import json
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..models.figma import FigmaPayloadRequest, FigmaPayloadResponse, FigmaDataResponse

router = APIRouter(prefix="/figma", tags=["Figma数据"])

# 存储目录
FIGMA_ASSETS_DIR = "figma-assets"


@router.post(
    "/payload",
    response_model=FigmaPayloadResponse,
    summary="存储 Figma Payload",
    description="接收 Figma 设计数据并存储到本地，返回 token 用于后续获取"
)
async def store_figma_payload(request: FigmaPayloadRequest):
    """
    存储 Figma Payload

    - **payload**: 任意格式的 Figma 设计数据（JSON）
    - 返回唯一 token 和创建时间
    """
    # 生成 token
    token = str(uuid.uuid4())
    created_at = datetime.now()

    # 确保目录存在
    os.makedirs(FIGMA_ASSETS_DIR, exist_ok=True)

    # 写入文件
    file_path = os.path.join(FIGMA_ASSETS_DIR, f"{token}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump({
            "token": token,
            "created_at": created_at.isoformat(),
            "payload": request.payload
        }, f, ensure_ascii=False, indent=2)

    return FigmaPayloadResponse(token=token, created_at=created_at)


@router.get(
    "/{token}",
    response_model=FigmaDataResponse,
    summary="获取 Figma Payload",
    description="根据 token 获取已存储的 Figma 设计数据"
)
async def get_figma_payload(token: str):
    """
    获取 Figma Payload

    - **token**: 存储时返回的唯一标识符
    - 返回完整的 Figma 数据和元信息
    """
    file_path = os.path.join(FIGMA_ASSETS_DIR, f"{token}.json")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Token 不存在")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return FigmaDataResponse(
        token=data["token"],
        data=data["payload"],
        created_at=datetime.fromisoformat(data["created_at"])
    )
