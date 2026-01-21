from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class MessageRole(str, Enum):
    """消息角色枚举"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    """消息模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: MessageRole = Field(..., description="消息角色")
    content: str = Field(..., description="消息内容")
    file_references: List[str] = Field(default_factory=list, description="关联的文件ID列表")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")


class FileInfo(BaseModel):
    """文件信息模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_name: str = Field(..., description="原始文件名")
    stored_name: str = Field(..., description="存储文件名")
    file_path: str = Field(..., description="文件完整路径")
    file_size: int = Field(..., description="文件大小（字节）")
    mime_type: Optional[str] = Field(None, description="MIME类型")
    upload_time: datetime = Field(default_factory=datetime.utcnow, description="上传时间")


class Conversation(BaseModel):
    """会话模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(..., description="会话标题")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")


class ConversationDetail(BaseModel):
    """会话详情（包含消息和文件）"""
    conversation: Conversation
    messages: List[Message]
    files: List[FileInfo]


# 请求/响应模型
class CreateConversationRequest(BaseModel):
    """创建会话请求"""
    title: str = Field(..., min_length=1, max_length=200, description="会话标题")


class CreateConversationResponse(BaseModel):
    """创建会话响应"""
    conversation_id: str
    title: str
    message: str = "会话创建成功"


class SendMessageRequest(BaseModel):
    """发送消息请求"""
    message: str = Field(..., min_length=1, description="用户消息内容")
    file_ids: List[str] = Field(default_factory=list, description="关联的文件ID列表")
    enable_thinking: bool = Field(False, description="是否启用思考模式（显示推理过程并进行深度分析）")


class ChatResponse(BaseModel):
    """对话响应"""
    message_id: str
    role: MessageRole
    content: str
    created_at: datetime


class FileUploadResponse(BaseModel):
    """文件上传响应"""
    file_id: str
    original_name: str
    file_size: int
    message: str = "文件上传成功"


# SSE事件模型（流式响应）
class SSEStartEvent(BaseModel):
    """SSE开始事件"""
    message_id: str


class SSEChunkEvent(BaseModel):
    """SSE文本块事件"""
    content: str
    thinking: Optional[bool] = False  # 标识是否为思考内容


class SSEEndEvent(BaseModel):
    """SSE结束事件"""
    message_id: str
    full_content: str


class SSEErrorEvent(BaseModel):
    """SSE错误事件"""
    error: str
