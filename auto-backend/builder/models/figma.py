from datetime import datetime
from pydantic import BaseModel, Field
from typing import Dict, Any


class FigmaPayloadRequest(BaseModel):
    """Figma Payload 请求"""
    payload: Dict[str, Any] = Field(..., description="Figma 设计数据")


class FigmaPayloadResponse(BaseModel):
    """Figma Payload 存储响应"""
    token: str = Field(..., description="唯一标识符")
    created_at: datetime = Field(..., description="创建时间")


class FigmaDataResponse(BaseModel):
    """Figma 数据获取响应"""
    token: str = Field(..., description="唯一标识符")
    data: Dict[str, Any] = Field(..., description="存储的 Figma 数据")
    created_at: datetime = Field(..., description="创建时间")
