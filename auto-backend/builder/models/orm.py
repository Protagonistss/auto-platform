from pydantic import BaseModel, Field
from typing import Optional


class WriteEntityRequest(BaseModel):
    """写入 Entity 请求"""
    xml: str = Field(..., description="完整的 entity XML 片段")
    source: str = Field(default="ai", description="来源：ai/chat/manual")
    task_id: Optional[str] = Field(None, description="关联任务ID")


class WriteEntityResponse(BaseModel):
    """写入 Entity 响应"""
    success: bool
    entity_name: str
    action: str  # created/updated
    message: str
