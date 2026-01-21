"""XML 核心包自定义异常"""


class XmlCoreError(Exception):
    """XML 处理基础异常"""
    pass


class XmlParseError(XmlCoreError):
    """XML 解析错误"""
    pass


class XmlMergeError(XmlCoreError):
    """XML 合并错误"""
    pass


class XmlFileNotFoundError(XmlCoreError):
    """XML 文件不存在错误"""
    pass


class XmlValidationError(XmlCoreError):
    """XML 验证错误"""
    pass
