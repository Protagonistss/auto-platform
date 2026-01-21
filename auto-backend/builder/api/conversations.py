from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, AsyncGenerator
from datetime import datetime
import uuid

from ..models.conversation import (
    CreateConversationRequest,
    CreateConversationResponse,
    SendMessageRequest,
    ConversationDetail,
    Conversation,
    FileUploadResponse,
    Message,
    MessageRole,
)
from ..services.conversation_service import ConversationService
from ..config import settings

router = APIRouter(prefix="/conversations", tags=["对话管理"])
conversation_service = ConversationService()


@router.post(
    "/",
    response_model=CreateConversationResponse,
    summary="创建会话",
    description="创建一个新的对话会话"
)
async def create_conversation(request: CreateConversationRequest):
    """
    创建新会话

    - **title**: 会话标题（1-200字符）
    """
    conversation = conversation_service.create_conversation(request.title)

    return CreateConversationResponse(
        conversation_id=conversation.id,
        title=conversation.title
    )


@router.post(
    "/{conversation_id}/upload",
    response_model=FileUploadResponse,
    summary="上传文件",
    description="上传文件到会话，支持多文件上传"
)
async def upload_file(
    conversation_id: str,
    files: List[UploadFile] = File(..., description="要上传的文件")
):
    """
    上传文件到会话

    - **conversation_id**: 会话ID
    - **files**: 一个或多个文件
    - 支持的文件类型: JSON, TXT, PDF, 图片等
    - 文件大小限制: 10MB
    """
    # 验证会话存在
    conversation = conversation_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 上传文件（返回第一个文件的结果）
    file_info = await conversation_service.upload_file(conversation_id, files[0])

    return FileUploadResponse(
        file_id=file_info.id,
        original_name=file_info.original_name,
        file_size=file_info.file_size
    )


@router.post(
    "/{conversation_id}/messages",
    summary="发送消息（流式响应）",
    description="发送消息并实时流式返回AI回复（SSE），支持思考模式"
)
async def send_message_stream(
    conversation_id: str,
    request: SendMessageRequest
):
    """
    发送消息到会话（流式SSE响应）

    - **conversation_id**: 会话ID
    - **message**: 用户消息内容
    - **file_ids**: 关联的文件ID列表（可选）
    - **enable_thinking**: 是否启用思考模式（显示推理过程）
    - 返回: SSE流式响应
    """
    # 验证会话存在
    session = conversation_service.store.get(conversation_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 创建用户消息
    user_message = Message(
        role=MessageRole.USER,
        content=request.message,
        file_references=request.file_ids or []
    )
    session.messages.append(user_message)

    # 构建对话上下文
    context_messages = []
    recent_messages = session.messages[-settings.max_context_messages:]

    for msg in recent_messages:
        file_content = ""
        if msg.file_references:
            # 读取关联文件内容
            file_contents = []
            for file_id in msg.file_references:
                if file_id in session.files:
                    file_info = session.files[file_id]
                    file_text = await conversation_service._read_file_content(file_info.file_path)
                    if file_text:
                        file_contents.append(f"\n[文件: {file_info.original_name}]\n{file_text}\n")
            file_content = "\n".join(file_contents)

        context_messages.append({
            "role": msg.role.value,
            "content": file_content + msg.content
        })

    # SSE生成器
    async def sse_generator() -> AsyncGenerator[str, None]:
        """SSE事件生成器，支持 GLM 原生思考模式"""
        full_response = ""
        message_id = str(uuid.uuid4())

        try:
            # 发送开始事件
            yield f"event: start\ndata: {{\"message_id\": \"{message_id}\", \"thinking_mode\": {str(request.enable_thinking).lower()}}}\n\n"

            # 流式生成文本
            # 调试：确认 enable_thinking 的值
            print(f"[DEBUG conversations.py] request.enable_thinking = {request.enable_thinking}", flush=True)
            print(f"[DEBUG conversations.py] request.model_dump() = {request.model_dump()}", flush=True)

            for chunk, is_thinking in conversation_service.ai_service.chat_stream(
                messages=context_messages,
                temperature=0.7,
                use_system_prompt=True,
                enable_thinking=request.enable_thinking
            ):
                full_response += chunk

                # 转义并发送内容
                escaped_chunk = chunk.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')

                # 确定是否为思考内容
                thinking_flag = "true" if is_thinking else "false"
                yield f"data: {{\"content\": \"{escaped_chunk}\", \"thinking\": {thinking_flag}}}\n\n"

            # 保存完整消息到会话
            assistant_message = Message(
                role=MessageRole.ASSISTANT,
                content=full_response
            )
            session.messages.append(assistant_message)
            session.updated_at = datetime.now()

            # 发送结束事件
            yield f"event: end\ndata: {{\"message_id\": \"{message_id}\"}}\n\n"

        except Exception as e:
            # 发送错误事件
            error_msg = str(e).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
            yield f"event: error\ndata: {{\"error\": \"{error_msg}\"}}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
        }
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
    summary="获取会话详情",
    description="获取会话及其所有消息和文件"
)
async def get_conversation(conversation_id: str):
    """
    获取会话详情

    - **conversation_id**: 会话ID
    - 返回会话信息、完整消息历史和文件列表
    """
    detail = conversation_service.get_conversation_detail(conversation_id)

    if not detail:
        raise HTTPException(status_code=404, detail="会话不存在")

    return detail


@router.get(
    "/",
    response_model=List[Conversation],
    summary="列出所有会话",
    description="获取当前所有会话列表"
)
async def list_conversations():
    """
    列出所有会话

    - 返回所有活跃会话的列表，按创建时间倒序
    """
    conversations = conversation_service.list_conversations()
    return conversations


@router.delete(
    "/{conversation_id}",
    summary="删除会话",
    description="删除会话及其所有消息和文件"
)
async def delete_conversation(conversation_id: str):
    """
    删除会话

    - **conversation_id**: 会话ID
    - 删除会话及其所有消息和文件（包括磁盘文件）
    """
    success = conversation_service.delete_conversation(conversation_id)

    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {"message": "会话已删除"}
