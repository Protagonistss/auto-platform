"""XML 命名空间处理器"""

from typing import List, Set, Optional
from lxml import etree


class NamespaceHandler:
    """XML 命名空间处理"""

    def __init__(self, prefixes: Optional[List[str]] = None):
        """
        初始化命名空间处理器

        Args:
            prefixes: 支持的命名空间前缀列表
        """
        if prefixes is None:
            self.prefixes = ['biz', 'ext', 'orm', 'i18n-en', 'ui', 'x', 'xpl', 'xs']
        else:
            self.prefixes = prefixes

    def detect_used_namespaces(self, xml: str) -> Set[str]:
        """
        检测 XML 中使用的命名空间前缀

        Args:
            xml: XML 字符串

        Returns:
            使用的命名空间前缀集合
        """
        used_namespaces = set()
        for prefix in self.prefixes:
            if f'{prefix}:' in xml:
                used_namespaces.add(prefix)
        return used_namespaces

    @staticmethod
    def build_namespace_declarations(prefixes: Set[str]) -> List[str]:
        """
        构建命名空间声明列表

        Args:
            prefixes: 命名空间前缀集合

        Returns:
            命名空间声明字符串列表
        """
        declarations = []
        for prefix in prefixes:
            declarations.append(f'xmlns:{prefix}="{prefix}"')
        return declarations

    def prepare_namespace_wrapper(self, xml: str) -> tuple[str, dict]:
        """
        为 XML 片段准备命名空间包装

        Args:
            xml: XML 片段

        Returns:
            (包装后的 XML, 命名空间映射字典)
        """
        cleaned = xml.replace("```xml", "").replace("```", "").strip()

        # 检测实际使用的命名空间
        used_namespaces = self.detect_used_namespaces(cleaned)

        # 构建命名空间映射
        ns_map = {}
        for prefix in used_namespaces:
            ns_map[prefix] = prefix

        # 如果使用了命名空间前缀，临时包装以提供命名空间上下文
        if used_namespaces:
            ns_decls = ' '.join([f'xmlns:{p}="{p}"' for p in used_namespaces])
            wrapper = f'<root {ns_decls}>{cleaned}</root>'
        else:
            wrapper = f'<root>{cleaned}</root>'

        return wrapper, ns_map

    @staticmethod
    def get_default_namespace_map() -> dict:
        """
        获取默认命名空间映射

        Returns:
            命名空间映射字典
        """
        return {
            'x': '/nop/schema/xdsl.xdef',
            'xpl': '/nop/schema/xpl.xdef'
        }
