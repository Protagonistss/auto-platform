"""xml_core 包测试用例"""

import pytest
import tempfile
import shutil
from pathlib import Path
from lxml import etree

from xml_core import XmlCore
from xml_core.namespace import NamespaceHandler
from xml_core.parser import XmlParser
from xml_core.formatter import XmlFormatter


# 获取 fixtures 目录路径
FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestNamespaceHandler:
    """测试命名空间处理器"""

    def test_detect_used_namespaces_with_biz(self):
        """测试检测 biz 命名空间"""
        handler = NamespaceHandler()
        xml = '<entity biz:type="entity"></entity>'
        result = handler.detect_used_namespaces(xml)
        assert 'biz' in result

    def test_detect_used_namespaces_multiple(self):
        """测试检测多个命名空间"""
        handler = NamespaceHandler()
        xml = '<entity biz:type="entity" ext:dict="type" ui:show="R"></entity>'
        result = handler.detect_used_namespaces(xml)
        assert 'biz' in result
        assert 'ext' in result
        assert 'ui' in result

    def test_detect_used_namespaces_none(self):
        """测试没有命名空间的情况"""
        handler = NamespaceHandler()
        xml = '<entity name="test"></entity>'
        result = handler.detect_used_namespaces(xml)
        assert len(result) == 0

    def test_custom_prefixes(self):
        """测试自定义前缀"""
        handler = NamespaceHandler(prefixes=['custom'])
        xml = '<entity custom:attr="val" biz:attr="ignored"></entity>'
        result = handler.detect_used_namespaces(xml)
        assert 'custom' in result
        assert 'biz' not in result


class TestXmlParser:
    """测试 XML 解析器"""

    def test_parse_fragment_simple(self):
        """测试解析简单的 XML 片段"""
        parser = XmlParser()
        xml = '<entity name="test"></entity>'
        element = parser.parse_fragment(xml, target_tag="entity")
        assert element is not None
        assert element.get("name") == "test"

    def test_parse_fragment_with_namespaces(self):
        """测试解析带命名空间的 XML 片段"""
        parser = XmlParser()
        xml = '<entity biz:type="entity" name="test"></entity>'
        element = parser.parse_fragment(xml, target_tag="entity")
        assert element is not None
        assert element.get("name") == "test"

    def test_parse_fragment_code_blocks(self):
        """测试解析带代码块标记的 XML"""
        parser = XmlParser()
        xml = '```xml\n<entity name="test"></entity>\n```'
        element = parser.parse_fragment(xml, target_tag="entity")
        assert element is not None
        assert element.get("name") == "test"


class TestXmlCore:
    """测试 XmlCore 主类"""

    @pytest.fixture
    def temp_orm_file(self):
        """创建临时 ORM 文件"""
        temp_dir = tempfile.mkdtemp()
        temp_file = Path(temp_dir) / "app.orm.xml"

        # 复制空的 ORM 模板
        source_file = FIXTURES_DIR / "sample_orm.xml"
        shutil.copy(source_file, temp_file)

        yield temp_file

        # 清理
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def temp_orm_file_with_entity(self):
        """创建包含 entity 的临时 ORM 文件"""
        temp_dir = tempfile.mkdtemp()
        temp_file = Path(temp_dir) / "app.orm.xml"

        # 复制包含 entity 的 ORM 文件
        source_file = FIXTURES_DIR / "sample_orm_with_entity.xml"
        shutil.copy(source_file, temp_file)

        yield temp_file

        # 清理
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def entity_xml_content(self):
        """读取 entity XML 内容"""
        with open(FIXTURES_DIR / "entity_xml.txt", "r", encoding="utf-8") as f:
            return f.read()

    @pytest.fixture
    def entity_xml_updated_content(self):
        """读取更新后的 entity XML 内容"""
        with open(FIXTURES_DIR / "entity_xml_updated.txt", "r", encoding="utf-8") as f:
            return f.read()

    def test_create_new_entity_append(self, temp_orm_file, entity_xml_content):
        """测试创建并追加新 entity（节点生成）"""
        core = XmlCore(str(temp_orm_file))

        # 合并 entity
        result = core.merge_entity(entity_xml_content)

        # 验证结果
        assert result.action == "created"
        assert result.identifier == "labor.tracking.dao.entity.LtProduct"

        # 验证文件内容
        tree = etree.parse(temp_orm_file)
        root = tree.getroot()
        entities = root.find(".//entities")
        assert entities is not None

        entity_list = entities.findall("entity")
        assert len(entity_list) == 1

        entity = entity_list[0]
        assert entity.get("name") == "labor.tracking.dao.entity.LtProduct"
        assert entity.get("tableName") == "lt_product"

        # 验证列
        columns = entity.find("columns")
        assert columns is not None
        column_list = columns.findall("column")
        assert len(column_list) == 8  # 应该有8个列

    def test_update_existing_entity(self, temp_orm_file_with_entity, entity_xml_updated_content):
        """测试更新已存在的 entity"""
        core = XmlCore(str(temp_orm_file_with_entity))

        # 更新 entity
        result = core.merge_entity(entity_xml_updated_content)

        # 验证结果
        assert result.action == "updated"
        assert result.identifier == "labor.tracking.dao.entity.LtProduct"

        # 验证文件内容
        tree = etree.parse(temp_orm_file_with_entity)
        root = tree.getroot()
        entities = root.find(".//entities")

        entity_list = entities.findall("entity")
        assert len(entity_list) == 1  # 仍然只有一个 entity

        entity = entity_list[0]
        # 验证已更新的属性
        assert entity.get("displayName") == "商品（更新）"

        # 验证列已更新
        columns = entity.find("columns")
        column_list = columns.findall("column")
        assert len(column_list) == 6  # 更新后的 entity 只有6个列

        # 验证特定列的 displayName 已更新
        product_name_col = None
        for col in column_list:
            if col.get("name") == "productName":
                product_name_col = col
                break

        assert product_name_col is not None
        assert product_name_col.get("displayName") == "商品名称（已更新）"

    def test_merge_entity_with_namespace_detection(self, temp_orm_file, entity_xml_content):
        """测试带命名空间自动检测的 entity 合并"""
        core = XmlCore(str(temp_orm_file))

        # 合并 entity（包含命名空间）
        result = core.merge_entity(entity_xml_content)

        assert result.action == "created"

        # 验证文件中命名空间正确
        with open(temp_orm_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 根元素应该有命名空间声明
        assert '<orm' in content
        # 子元素不应该有命名空间声明
        # 检查 entity 元素没有 xmlns: 属性
        tree = etree.parse(temp_orm_file)
        root = tree.getroot()
        entities = root.find(".//entities")
        entity = entities.find("entity")

        # entity 元素不应该有 xmlns 属性
        for attr in entity.attrib:
            assert not attr.startswith('xmlns:')

    def test_find_element(self, temp_orm_file_with_entity):
        """测试查找元素"""
        core = XmlCore(str(temp_orm_file_with_entity))

        # 查找 entity
        entity = core.find_element('.//entity')
        assert entity is not None
        assert entity.get("name") == "labor.tracking.dao.entity.LtProduct"

        # 查找 columns
        columns = core.find_element('.//columns')
        assert columns is not None

    def test_parse_file(self, temp_orm_file_with_entity):
        """测试解析文件"""
        core = XmlCore(str(temp_orm_file_with_entity))

        tree = core.parse_file()
        assert tree is not None

        root = tree.getroot()
        assert root.tag == "orm"

    def test_format_element(self, temp_orm_file_with_entity):
        """测试格式化元素"""
        core = XmlCore(str(temp_orm_file_with_entity))

        entity = core.find_element('.//entity')
        formatted = core.format_element(entity)

        assert isinstance(formatted, str)
        assert '<entity' in formatted
        assert 'labor.tracking.dao.entity.LtProduct' in formatted


class TestXmlFormatter:
    """测试 XML 格式化器"""

    def test_serialize_tree(self):
        """测试序列化 XML 树"""
        temp_dir = tempfile.mkdtemp()
        temp_file = Path(temp_dir) / "test.xml"

        try:
            # 创建测试文件
            source_file = FIXTURES_DIR / "sample_orm.xml"
            shutil.copy(source_file, temp_file)

            formatter = XmlFormatter()
            parser = XmlParser()
            tree = parser.parse_file(str(temp_file))

            # 序列化
            xml_str = formatter.serialize(tree)

            assert isinstance(xml_str, str)
            assert '<?xml' in xml_str
            assert '<orm' in xml_str

        finally:
            shutil.rmtree(temp_dir)

    def test_strip_child_namespaces(self):
        """测试移除子元素命名空间"""
        xml_with_ns = '''<root>
            <entity xmlns:biz="biz" name="test">
                <column xmlns:ext="ext" name="id"/>
            </entity>
        </root>'''

        formatter = XmlFormatter()
        # 解析并重新序列化
        parser = XmlParser()
        root = etree.fromstring(xml_with_ns.encode('utf-8'))
        tree = etree.ElementTree(root)

        result = formatter.serialize(tree, strip_child_ns=True)

        # 验证子元素的 xmlns 被移除
        # 找到 entity 标签的位置
        entity_pos = result.find('<entity')
        entity_end = result.find('>', entity_pos)
        entity_tag = result[entity_pos:entity_end + 1]

        # entity 标签不应该有 xmlns 属性
        assert 'xmlns:' not in entity_tag


class TestIntegration:
    """集成测试"""

    def test_full_workflow(self):
        """测试完整的工作流：创建 -> 更新"""
        temp_dir = tempfile.mkdtemp()
        temp_file = Path(temp_dir) / "app.orm.xml"

        try:
            # 1. 创建空的 ORM 文件
            source_file = FIXTURES_DIR / "sample_orm.xml"
            shutil.copy(source_file, temp_file)

            core = XmlCore(str(temp_file))

            # 2. 读取 entity XML
            with open(FIXTURES_DIR / "entity_xml.txt", "r", encoding="utf-8") as f:
                entity_xml = f.read()

            # 3. 首次合并（创建）
            result1 = core.merge_entity(entity_xml)
            assert result1.action == "created"
            assert result1.identifier == "labor.tracking.dao.entity.LtProduct"

            # 4. 验证只有一个 entity
            tree = etree.parse(temp_file)
            root = tree.getroot()
            entities = root.find(".//entities")
            entity_list = entities.findall("entity")
            assert len(entity_list) == 1

            # 5. 读取更新的 entity XML
            with open(FIXTURES_DIR / "entity_xml_updated.txt", "r", encoding="utf-8") as f:
                updated_entity_xml = f.read()

            # 6. 再次合并（更新）
            result2 = core.merge_entity(updated_entity_xml)
            assert result2.action == "updated"
            assert result2.identifier == "labor.tracking.dao.entity.LtProduct"

            # 7. 验证仍然只有一个 entity
            tree = etree.parse(temp_file)
            root = tree.getroot()
            entities = root.find(".//entities")
            entity_list = entities.findall("entity")
            assert len(entity_list) == 1  # 更新后仍然只有一个

            # 8. 验证内容已更新
            entity = entity_list[0]
            assert entity.get("displayName") == "商品（更新）"

        finally:
            shutil.rmtree(temp_dir)

    def test_multiple_entities(self):
        """测试多个不同实体的创建和更新"""
        temp_dir = tempfile.mkdtemp()
        temp_file = Path(temp_dir) / "app.orm.xml"

        try:
            # 1. 创建空的 ORM 文件
            source_file = FIXTURES_DIR / "sample_orm.xml"
            shutil.copy(source_file, temp_file)

            core = XmlCore(str(temp_file))

            # 2. 添加第一个实体（商品）
            product_xml = """<entity className="labor.tracking.dao.entity.LtProduct" name="labor.tracking.dao.entity.LtProduct" tableName="lt_product" displayName="商品" registerShortName="true">
                <columns>
                    <column name="id" code="ID" propId="1" stdSqlType="INTEGER" stdDataType="int" primary="true" displayName="ID"/>
                    <column name="productName" code="PRODUCT_NAME" propId="2" stdSqlType="VARCHAR" stdDataType="string" displayName="商品名称"/>
                </columns>
            </entity>"""

            result1 = core.merge_entity(product_xml)
            assert result1.action == "created"
            assert result1.identifier == "labor.tracking.dao.entity.LtProduct"

            # 3. 添加第二个实体（订单）
            order_xml = """<entity className="labor.tracking.dao.entity.LtOrder" name="labor.tracking.dao.entity.LtOrder" tableName="lt_order" displayName="订单" registerShortName="true">
                <columns>
                    <column name="id" code="ID" propId="1" stdSqlType="INTEGER" stdDataType="int" primary="true" displayName="ID"/>
                    <column name="orderNo" code="ORDER_NO" propId="2" stdSqlType="VARCHAR" stdDataType="string" displayName="订单号"/>
                    <column name="amount" code="AMOUNT" propId="3" stdSqlType="DECIMAL" stdDataType="decimal" displayName="金额"/>
                </columns>
            </entity>"""

            result2 = core.merge_entity(order_xml)
            assert result2.action == "created"
            assert result2.identifier == "labor.tracking.dao.entity.LtOrder"

            # 4. 添加第三个实体（用户）
            user_xml = """<entity className="labor.tracking.dao.entity.LtUser" name="labor.tracking.dao.entity.LtUser" tableName="lt_user" displayName="用户" registerShortName="true">
                <columns>
                    <column name="id" code="ID" propId="1" stdSqlType="INTEGER" stdDataType="int" primary="true" displayName="ID"/>
                    <column name="userName" code="USER_NAME" propId="2" stdSqlType="VARCHAR" stdDataType="string" displayName="用户名"/>
                    <column name="email" code="EMAIL" propId="3" stdSqlType="VARCHAR" stdDataType="string" displayName="邮箱"/>
                </columns>
            </entity>"""

            result3 = core.merge_entity(user_xml)
            assert result3.action == "created"
            assert result3.identifier == "labor.tracking.dao.entity.LtUser"

            # 5. 验证有三个不同的实体
            tree = etree.parse(temp_file)
            root = tree.getroot()
            entities = root.find(".//entities")
            entity_list = entities.findall("entity")
            assert len(entity_list) == 3

            # 验证每个实体的名称
            entity_names = {e.get("name") for e in entity_list}
            assert entity_names == {
                "labor.tracking.dao.entity.LtProduct",
                "labor.tracking.dao.entity.LtOrder",
                "labor.tracking.dao.entity.LtUser"
            }

            # 6. 更新第一个实体（商品）
            product_updated_xml = """<entity className="labor.tracking.dao.entity.LtProduct" name="labor.tracking.dao.entity.LtProduct" tableName="lt_product" displayName="商品（已更新）" registerShortName="true">
                <columns>
                    <column name="id" code="ID" propId="1" stdSqlType="INTEGER" stdDataType="int" primary="true" displayName="ID"/>
                    <column name="productName" code="PRODUCT_NAME" propId="2" stdSqlType="VARCHAR" stdDataType="string" displayName="商品名称（已更新）"/>
                    <column name="price" code="PRICE" propId="3" stdSqlType="DECIMAL" stdDataType="decimal" displayName="价格"/>
                </columns>
            </entity>"""

            result4 = core.merge_entity(product_updated_xml)
            assert result4.action == "updated"
            assert result4.identifier == "labor.tracking.dao.entity.LtProduct"

            # 7. 验证仍然只有三个实体，且商品实体已更新
            tree = etree.parse(temp_file)
            root = tree.getroot()
            entities = root.find(".//entities")
            entity_list = entities.findall("entity")
            assert len(entity_list) == 3

            # 找到商品实体并验证更新
            product_entity = None
            for e in entity_list:
                if e.get("name") == "labor.tracking.dao.entity.LtProduct":
                    product_entity = e
                    break

            assert product_entity is not None
            assert product_entity.get("displayName") == "商品（已更新）"

            # 验证列已更新
            columns = product_entity.find("columns")
            column_list = columns.findall("column")
            assert len(column_list) == 3  # 更新后有3列

            # 验证新增了价格列
            column_names = {c.get("name") for c in column_list}
            assert "price" in column_names

            # 8. 添加第四个实体（商品分类）
            category_xml = """<entity className="labor.tracking.dao.entity.LtCategory" name="labor.tracking.dao.entity.LtCategory" tableName="lt_category" displayName="商品分类" registerShortName="true">
                <columns>
                    <column name="id" code="ID" propId="1" stdSqlType="INTEGER" stdDataType="int" primary="true" displayName="ID"/>
                    <column name="categoryName" code="CATEGORY_NAME" propId="2" stdSqlType="VARCHAR" stdDataType="string" displayName="分类名称"/>
                </columns>
            </entity>"""

            result5 = core.merge_entity(category_xml)
            assert result5.action == "created"
            assert result5.identifier == "labor.tracking.dao.entity.LtCategory"

            # 9. 最终验证：有四个实体
            tree = etree.parse(temp_file)
            root = tree.getroot()
            entities = root.find(".//entities")
            entity_list = entities.findall("entity")
            assert len(entity_list) == 4

            entity_names = {e.get("name") for e in entity_list}
            assert entity_names == {
                "labor.tracking.dao.entity.LtProduct",
                "labor.tracking.dao.entity.LtOrder",
                "labor.tracking.dao.entity.LtUser",
                "labor.tracking.dao.entity.LtCategory"
            }

        finally:
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
