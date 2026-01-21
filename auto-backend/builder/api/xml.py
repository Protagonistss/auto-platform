"""统一 XML 合并 API"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from xml_core import XmlCore
from ..config import get_xml_config


router = APIRouter()


class MergeXmlRequest(BaseModel):
    """XML 合并请求"""
    xml_type: str  # XML 类型（orm/config/api 等）
    xml: str  # XML 片段
    source: str = "chat"  # 来源标识
    task_id: Optional[str] = None  # 关联任务ID


class MergeXmlResponse(BaseModel):
    """XML 合并响应"""
    success: bool
    xml_type: str
    identifier: str  # 元素标识（name/key/path 等）
    action: str  # created/updated
    display_name: str  # 类型显示名称
    message: str


@router.post("/merge", response_model=MergeXmlResponse, summary="合并 XML")
async def merge_xml(request: MergeXmlRequest):
    """
    通用 XML 合并接口

    支持多种 XML 类型的合并：
    - **orm**: ORM Entity 实体定义
    - **config**: 配置项设置
    - **api**: API 接口定义

    请求参数：
    - **xml_type**: XML 类型标识
    - **xml**: XML 片段内容
    - **source**: 来源标识（ai/chat/manual）
    - **task_id**: 关联任务ID（可选）

    返回操作结果，包含元素标识和操作类型（创建/更新）
    """
    # 获取 XML 类型配置
    config = get_xml_config(request.xml_type)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的 XML 类型: {request.xml_type}，支持的类型: {list(get_xml_config.__self__)}"
        )

    try:
        # 使用 xml_core 进行合并
        core = XmlCore(xml_path=config.xml_path)
        result = core.merge_element(
            element_xml=request.xml,
            parent_xpath=config.parent_xpath,
            element_matcher=config.element_matcher
        )

        action_text = "创建" if result.action == "created" else "更新"

        return MergeXmlResponse(
            success=True,
            xml_type=request.xml_type,
            identifier=result.identifier,
            action=result.action,
            display_name=config.display_name,
            message=f"{config.display_name} [{result.identifier}] 已成功{action_text}"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合并失败: {str(e)}")


@router.get("/types", summary="获取支持的 XML 类型")
async def get_xml_types():
    """
    获取所有支持的 XML 类型

    返回所有可用的 XML 类型配置
    """
    from ..config import XML_BUILD_TYPES

    types = []
    for type_id, config in XML_BUILD_TYPES.items():
        types.append({
            "type": type_id,
            "name": config.name,
            "display_name": config.display_name,
            "element_tag": config.element_tag,
            "description": f"合并 {config.display_name} 到 {config.xml_path}"
        })

    return {"types": types}
