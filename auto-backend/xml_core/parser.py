"""XML 解析器"""

import logging
from pathlib import Path
from typing import Optional, List
from lxml import etree

from .namespace import NamespaceHandler
from .exceptions import XmlParseError, XmlFileNotFoundError


logger = logging.getLogger(__name__)


class XmlParser:
    """XML 解析器"""

    def __init__(self, encoding: str = "utf-8", namespaces: Optional[List[str]] = None):
        """
        初始化解析器

        Args:
            encoding: 文件编码
            namespaces: 支持的命名空间前缀列表
        """
        self.encoding = encoding
        self.ns_handler = NamespaceHandler(prefixes=namespaces)

    def parse_file(
        self,
        file_path: str,
        auto_fix_namespaces: bool = True
    ) -> etree._ElementTree:
        """
        解析 XML 文件

        Args:
            file_path: XML 文件路径
            auto_fix_namespaces: 是否自动尝试修复命名空间（使用 recover 模式）

        Returns:
            ElementTree 对象

        Raises:
            XmlFileNotFoundError: 文件不存在
            XmlParseError: 解析失败
        """
        path = Path(file_path)
        if not path.exists():
            raise XmlFileNotFoundError(f"文件不存在: {file_path}")

        # 使用 recover=True 来处理可能缺失命名空间的文件
        # 这比正则替换更安全，lxml 会尽力解析
        parser = etree.XMLParser(
            remove_blank_text=False,
            remove_comments=False,
            recover=auto_fix_namespaces  # 启用恢复模式
        )

        try:
            tree = etree.parse(file_path, parser)
            return tree
        except Exception as e:
            raise XmlParseError(f"解析文件失败: {e}")

    def parse_fragment(
        self,
        xml: str,
        target_tag: str = None,
        auto_namespaces: bool = True
    ) -> etree._Element:
        """
        解析 XML 片段

        Args:
            xml: XML 片段字符串
            target_tag: 目标标签名（如果为 None，返回第一个子元素）
            auto_namespaces: 是否自动处理命名空间

        Returns:
            Element 对象

        Raises:
            XmlParseError: 解析失败
        """
        # 清理代码块标记
        cleaned = xml.replace("```xml", "").replace("```", "").strip()

        if auto_namespaces:
            wrapper, ns_map = self.ns_handler.prepare_namespace_wrapper(cleaned)
        else:
            wrapper = f'<root>{cleaned}</root>'
            ns_map = {}

        parser = etree.XMLParser(remove_blank_text=False)

        try:
            root = etree.fromstring(wrapper.encode(self.encoding), parser)

            if target_tag:
                # 带命名空间的查找
                if ns_map:
                    # 使用命名空间映射查找
                    element = root.find(f".//{target_tag}", namespaces=ns_map)
                    if element is None:
                        # 如果没找到，尝试不带命名空间的查找
                        element = root.find(f".//{target_tag}")
                else:
                    element = root.find(f".//{target_tag}")

                if element is None:
                    raise XmlParseError(f"未找到目标标签: {target_tag}")
                return element

            # 如果没有指定 target_tag，返回第一个子元素
            # 使用 list(root) 获取所有子节点
            all_children = list(root)

            # 过滤出实际的元素（跳过纯文本节点）
            children = []
            for child in all_children:
                # 使用 etree.iselement 来判断是否为 Element
                if etree.iselement(child):
                    children.append(child)

            if len(children) == 0:
                # 调试：输出 root 的信息
                logger.error(f"Root 没有子元素. Root tag: {root.tag}, 所有子节点数: {len(all_children)}")
                # 输出所有子节点的信息
                for i, child in enumerate(all_children):
                    logger.error(f"  子节点 {i}: type={type(child)}, tag={getattr(child, 'tag', 'N/A')}")
                raise XmlParseError("XML 片段没有子元素")

            return children[0]

        except Exception as e:
            logger.error(f"XML 解析失败: {e}\nXML 内容: {cleaned[:500]}")
            raise XmlParseError(f"XML 解析失败: {e}")

    def parse_element_with_config(
        self,
        xml: str,
        element_tag: str = "entity"
    ) -> etree._Element:
        """
        解析 XML 元素（用于配置场景）

        Args:
            xml: XML 片段
            element_tag: 元素标签名

        Returns:
            Element 对象

        Raises:
            XmlParseError: 解析失败或未找到元素
        """
        element = self.parse_fragment(xml, target_tag=element_tag)

        # 移除元素上的命名空间声明
        for ns_attr in list(element.attrib.keys()):
            if ns_attr.startswith('xmlns:'):
                del element.attrib[ns_attr]

        return element

    def get_root(self, tree: etree._ElementTree) -> etree._Element:
        """
        获取树的根元素

        Args:
            tree: ElementTree 对象

        Returns:
            根元素
        """
        return tree.getroot()

    def find_element(
        self,
        root: etree._Element,
        xpath: str,
        namespace_map: Optional[dict] = None
    ) -> Optional[etree._Element]:
        """
        查找元素

        Args:
            root: 根元素
            xpath: XPath 表达式
            namespace_map: 命名空间映射

        Returns:
            找到的元素，未找到返回 None
        """
        ns_map = namespace_map or NamespaceHandler.get_default_namespace_map()
        return root.find(xpath, ns_map)

    def find_elements(
        self,
        root: etree._Element,
        xpath: str,
        namespace_map: Optional[dict] = None
    ) -> list:
        """
        查找多个元素

        Args:
            root: 根元素
            xpath: XPath 表达式
            namespace_map: 命名空间映射

        Returns:
            元素列表
        """
        ns_map = namespace_map or NamespaceHandler.get_default_namespace_map()
        return root.findall(xpath, ns_map)
