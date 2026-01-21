"""ORM Entity API（兼容接口）"""

from fastapi import APIRouter, HTTPException
from ..models.orm import WriteEntityRequest, WriteEntityResponse
from .xml import merge_xml, MergeXmlRequest

router = APIRouter()


@router.post("/orm/entity", response_model=WriteEntityResponse, summary="写入 Entity（兼容接口）")
async def write_entity(request: WriteEntityRequest):
    """
    将 AI 生成的 entity 写入 app.orm.xml

    **注意**: 这是兼容接口，内部调用统一的 /xml/merge 接口

    - **xml**: entity XML 片段（符合 orm.md 规范）
    - **source**: 来源标识（ai/chat/manual）
    - **task_id**: 关联任务ID（可选）

    返回操作结果
    """
    try:
        # 转换为统一的 XML 合并请求
        merge_request = MergeXmlRequest(
            xml_type="orm",
            xml=request.xml,
            source=request.source,
            task_id=request.task_id
        )

        # 调用统一接口
        result = await merge_xml(merge_request)

        # 转换响应格式
        return WriteEntityResponse(
            success=result.success,
            entity_name=result.identifier,
            action=result.action,
            message=result.message
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (FileNotFoundError, IOError) as e:
        raise HTTPException(status_code=500, detail=str(e))
