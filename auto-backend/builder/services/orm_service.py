"""ORM XML 服务

使用 xml_core 包提供的通用 XML 处理功能。
"""

from pydantic import BaseModel
from xml_core import XmlCore
from ..config import settings


class WriteEntityResult(BaseModel):
    """写入结果"""
    entity_name: str
    action: str  # created/updated


class OrmXmlService:
    """ORM XML 文件操作服务"""

    def __init__(self):
        # 使用 xml_core 包
        self.core = XmlCore.for_orm(
            xml_path=settings.orm_xml_path,
            encoding="utf-8"
        )

    def write_entity(self, entity_xml: str) -> WriteEntityResult:
        """
        智能合并 entity 到 app.orm.xml

        Args:
            entity_xml: entity XML 片段

        Returns:
            WriteEntityResult: 写入结果

        Raises:
            ValueError: XML 解析失败或缺少必填字段
            FileNotFoundError: 文件不存在
            IOError: 文件操作失败
        """
        result = self.core.merge_entity(entity_xml)

        return WriteEntityResult(
            entity_name=result.identifier,
            action=result.action
        )
