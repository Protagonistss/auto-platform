# 从表格配置生成 ORM 实体指导提示词

## 一、输入格式说明

输入是一个前端 UI 页面配置 JSON 对象，包含以下结构：

### 主要路径：
- `body.table.columns`: 表格列定义数组，每个列包含：
  - `title`: 列标题（中文显示名）
  - `dataIndex`: 字段标识（用于数据绑定）
  - `width`: 列宽度（可选）
  - `align`: 对齐方式（可选）

- `body.search.fields`: 搜索字段定义数组（可选），每个字段包含：
  - `label`: 字段标签
  - `type`: 字段类型（input/select/date等）
  - `key`: 字段标识

**注意：输入的是前端页面配置，不是数据库表结构。你需要根据列标题（title）和字段标识（dataIndex）推断出合适的数据库字段类型。**

## 二、输出格式说明

输出为 Nop 平台的 ORM 实体定义（XML 格式），单 entity 片段格式：

```xml
<entity className="app.module.EntityName"
        name="app.module.EntityName"
        tableName="table_name"
        displayName="实体显示名"
        registerShortName="true"
        createTimeProp="addTime"
        updateTimeProp="updateTime"
        deleteFlagProp="deleted"
        useLogicalDelete="true"
        i18n-en:displayName="Entity Display Name">
    <columns>
        <!-- 字段定义 -->
    </columns>
    <comment>实体注释</comment>
</entity>
```

**重要**：
- `className` 和 `name` 必须相同，都是完整的 Java 类名
- 必须包含逻辑删除相关属性：`deleteFlagProp`, `useLogicalDelete`
- 必须包含时间戳属性：`createTimeProp`, `updateTimeProp`
- 必须添加 i18n 支持：`i18n-en:displayName`
- 必须添加 `<comment>` 注释标签

## 三、核心生成规则

### 3.1 实体命名规范

1. **实体类名（className 和 name 属性）**：
   - 格式：`{package}.{Prefix}{EntityName}`
   - 使用配置的默认包名：`{{DEFAULT_PACKAGE}}`
   - **类名必须包含表前缀**，前缀从 `{{TABLE_PREFIX}}` 提取并转换为 PascalCase
   - 前缀转换规则：`lt_` → `Lt`，`mall_` → `Mall`，`shop_` → `Shop`
   - 示例：
     - 如果 `TABLE_PREFIX=lt_`，实体名为 `Product`，则完整类名为 `{{DEFAULT_PACKAGE}}.LtProduct`
     - 如果 `TABLE_PREFIX=lt_`，实体名为 `UserInfo`，则完整类名为 `{{DEFAULT_PACKAGE}}.LtUserInfo`
     - 如果 `TABLE_PREFIX=mall_`，实体名为 `Order`，则完整类名为 `{{DEFAULT_PACKAGE}}.MallOrder`
   - **重要**：`className` 和 `name` 必须完全相同，都必须包含前缀

2. **表名（tableName 属性）**：
   - 格式：`{prefix}{table_name}`（全小写下划线命名）
   - 使用配置的表前缀：`{{TABLE_PREFIX}}`
   - 从实体名转换：PascalCase → snake_case（**必须使用下划线分隔单词**）
   - 示例：
     - `LtProduct` → `lt_product`（注意是下划线不是连字符）
     - `LtUserInfo` → `lt_user_info`
     - `MallOrder` → `mall_order`
     - `ShopCategory` → `shop_category`
   - **重要**：实体名中的每个大写字母或单词都要用下划线分隔，不能连写

3. **显示名（displayName 属性）**：
   - 使用表格的标题或实体名称的中文描述
   - 示例：`商品信息`、`订单明细`

### 3.2 字段命名规范

1. **Java 属性名（name 属性）**：
   - 格式：camelCase
   - 从 `dataIndex` 转换：下划线/中文 → camelCase
   - 示例：`商品名称` → `productName`，`商品数量` → `productQuantity`

2. **数据库列名（code 属性）**：
   - 格式：全大写下划线
   - 从 `name` 转换：camelCase → UPPER_SNAKE_CASE
   - 示例：`productName` → `PRODUCT_NAME`
   - 避免 SQL 关键字冲突（如 `order` → `order_no`）

3. **显示名（displayName 属性）**：
   - 直接使用 `title` 字段的值
   - 示例：`商品名称`、`商品数量`
   - **可选**：如果需要国际化支持，可以添加 `i18n-en:displayName`（英文显示名）

### 3.3 数据类型映射规则

根据字段的语义和类型，映射到对应的 SQL 类型和 stdDataType：

| 字段语义/类型 | stdSqlType | stdDataType | precision | scale | 说明 |
|--------------|-----------|-------------|-----------|-------|------|
| 主键ID | INTEGER | int | - | - | 自增主键 |
| 名称/标题/文本 | VARCHAR | string | 255 | - | 默认长度255 |
| 数量/计数 | INTEGER | int | - | - | 整数类型 |
| 金额/价格 | DECIMAL | decimal | 18 | 2 | 金额字段固定精度 |
| 百分比 | DECIMAL | decimal | 5 | 2 | 百分比字段 |
| 日期 | DATE | date | - | - | 仅日期 |
| 日期时间 | DATETIME | datetime | - | - | 日期+时间 |
| 时间 | TIME | time | - | - | 仅时间 |
| 布尔值 | BOOLEAN | boolean | - | - | true/false |
| 状态/来源/类型 | VARCHAR | string | 255 | - | 短文本 |
| 描述/备注 | VARCHAR | string | 500-2000 | - | 长文本 |
| 创建时间 | DATETIME | datetime | - | - | domain="createTime" |
| 更新时间 | DATETIME | datetime | - | - | domain="updateTime" |
| 逻辑删除 | BOOLEAN | boolean | - | - | domain="delFlag" |

### 3.4 字段属性配置

1. **主键字段**：
   - 固定字段名：`id`
   - 类型：`INTEGER`
   - 必须添加 `stdDataType="int"`
   - 必须添加 `tagSet="seq"` (序列标签)
   - 必须添加 `ui:show="R"` (只读显示)
   - 示例：
   ```xml
   <column name="id" code="ID" propId="1" stdSqlType="INTEGER"
           stdDataType="int" tagSet="seq" ui:show="R"
           primary="true" mandatory="true"
           displayName="Id" i18n-en:displayName="Id"/>
   ```

2. **propId 分配**：
   - 从 1 开始递增
   - 主键固定为 1
   - 业务字段从 2 开始
   - 系统字段（addTime, updateTime, deleted）放在最后

3. **业务字段属性**：
   - **必填属性**：`name`, `code`, `propId`, `stdSqlType`, `stdDataType`, `displayName`
   - **推荐属性**：
     - `mandatory="true"` - 必填字段
     - `precision` - VARCHAR 长度，默认 255
     - `scale` - DECIMAL 精度
     - `i18n-en:displayName` - 英文显示名
   - **可选属性**：
     - `tagSet="disp"` - 显示标签（用于列表展示字段）
     - `domain` - 数据域（如 createTime, updateTime, delFlag）

4. **系统字段（必须添加）**：
   - **创建时间**：
   ```xml
   <column name="addTime" code="ADD_TIME" propId="N" stdSqlType="DATETIME"
           stdDataType="datetime" domain="createTime" displayName="创建时间"
           i18n-en:displayName="Create Time" ui:show="X"/>
   ```
   - **更新时间**：
   ```xml
   <column name="updateTime" code="UPDATE_TIME" propId="N+1" stdSqlType="DATETIME"
           stdDataType="datetime" domain="updateTime" displayName="更新时间"
           i18n-en:displayName="Update Time" ui:show="X"/>
   ```
   - **逻辑删除**：
   ```xml
   <column name="deleted" code="DELETED" propId="N+2" stdSqlType="BOOLEAN"
           stdDataType="boolean" domain="delFlag" displayName="逻辑删除"
           i18n-en:displayName="Deleted" ui:show="X"/>
   ```
   - **ui:show="X"** 表示在界面中不显示

### 3.5 必填配置项

1. **实体级别**：
   - `className`: 实体完整 Java 类名
   - `name`: 实体完整类名（与 className 相同）
   - `tableName`: 数据库表名
   - `displayName`: 显示名称
   - `registerShortName`: 是否注册短名称（通常为 `true`）
   - `createTimeProp`: 创建时间字段名（固定为 `addTime`）
   - `updateTimeProp`: 更新时间字段名（固定为 `updateTime`）
   - `deleteFlagProp`: 逻辑删除字段名（固定为 `deleted`）
   - `useLogicalDelete`: 是否使用逻辑删除（固定为 `true`）
   - `i18n-en:displayName`: 英文显示名

2. **字段级别**：
   - `name`: Java 属性名
   - `code`: 数据库列名
   - `propId`: 属性ID（唯一，从1开始）
   - `stdSqlType`: SQL 类型（必填）
   - `stdDataType`: Java 数据类型（必填）
   - `displayName`: 显示名称
   - `i18n-en:displayName`: 英文显示名

## 四、生成流程

### 步骤1：解析输入 JSON
1. 提取表格列定义（`body.table.columns`）
2. 提取搜索字段定义（`body.search.fields`，可选）
3. 识别实体名称（从上下文或第一个列推断）

### 步骤2：生成实体定义
1. 确定实体名称和表名
2. 设置所有必填属性（包括 className, createTimeProp, updateTimeProp, deleteFlagProp, useLogicalDelete）
3. 设置 i18n 支持（i18n-en:displayName）

### 步骤3：生成字段定义
1. 添加主键字段 `id`（propId=1，INTEGER 类型）
2. 对每个业务列执行：
   - 字段名转换：`dataIndex` → camelCase
   - 类型推断：根据 `title` 和 `dataIndex` 推断类型
   - 属性设置：propId, stdSqlType, stdDataType, displayName, i18n-en:displayName
3. 添加系统字段（放在最后）：
   - addTime（创建时间）
   - updateTime（更新时间）
   - deleted（逻辑删除）

### 步骤4：生成完整 XML
组装 entity 片段，添加 `<comment>` 注释

## 五、示例转换

### 输入 JSON：
```json
{
  "body": {
    "table": {
      "columns": [
        {"title": "商品名称", "dataIndex": "商品名称"},
        {"title": "商品数量", "dataIndex": "商品数量"},
        {"title": "商品来源", "dataIndex": "商品来源"},
        {"title": "商品价格", "dataIndex": "商品价格"}
      ]
    }
  }
}
```

### 输出 ORM XML：
```xml
<entity className="{{DEFAULT_PACKAGE}}.LtProduct"
        name="{{DEFAULT_PACKAGE}}.LtProduct"
        tableName="{{TABLE_PREFIX}}product"
        displayName="商品"
        registerShortName="true"
        createTimeProp="addTime"
        updateTimeProp="updateTime"
        deleteFlagProp="deleted"
        useLogicalDelete="true">
    <columns>
        <column name="id" code="ID" propId="1" stdSqlType="INTEGER"
                stdDataType="int" tagSet="seq" ui:show="R"
                primary="true" mandatory="true"
                displayName="Id"/>
        <column name="productName" code="PRODUCT_NAME" propId="2"
                stdSqlType="VARCHAR" stdDataType="string" precision="255"
                mandatory="true" tagSet="disp"
                displayName="商品名称"/>
        <column name="productQuantity" code="PRODUCT_QUANTITY" propId="3"
                stdSqlType="INTEGER" stdDataType="int"
                displayName="商品数量"/>
        <column name="productSource" code="PRODUCT_SOURCE" propId="4"
                stdSqlType="VARCHAR" stdDataType="string" precision="255"
                displayName="商品来源"/>
        <column name="productPrice" code="PRODUCT_PRICE" propId="5"
                stdSqlType="DECIMAL" stdDataType="decimal" precision="18" scale="2"
                displayName="商品价格"/>
        <column name="addTime" code="ADD_TIME" propId="6"
                stdSqlType="DATETIME" stdDataType="datetime" domain="createTime"
                displayName="创建时间" ui:show="X"/>
        <column name="updateTime" code="UPDATE_TIME" propId="7"
                stdSqlType="DATETIME" stdDataType="datetime" domain="updateTime"
                displayName="更新时间" ui:show="X"/>
        <column name="deleted" code="DELETED" propId="8"
                stdSqlType="BOOLEAN" stdDataType="boolean" domain="delFlag"
                displayName="逻辑删除" ui:show="X"/>
    </columns>
    <comment>商品信息</comment>
</entity>
```

## 六、约束条件

1. **主键固定**：必须使用 `id` 字段，类型 `INTEGER`，带 `stdDataType="int"`, `tagSet="seq"`, `ui:show="R"`
2. **SQL 类型限制**：仅允许 `VARCHAR/CHAR/DATE/TIME/DATETIME/TIMESTAMP/INTEGER/BIGINT/DECIMAL/BOOLEAN/VARBINARY`
3. **必填系统字段**：必须添加 `addTime`, `updateTime`, `deleted` 三个系统字段
4. **命名规范**：避免 SQL 关键字，使用下划线命名数据库列

## 七、特殊处理

1. **中文字段名处理**：
   - 如果 `dataIndex` 是中文，尝试从 `title` 提取英文含义
   - 或使用拼音转换（如 `商品名称` → `productName`）

2. **类型推断增强**：
   - 字段名包含"数量"、"个数" → `INTEGER`
   - 字段名包含"价格"、"金额"、"费用" → `DECIMAL(18,2)`
   - 字段名包含"日期" → `DATE` 或 `DATETIME`
   - 字段名包含"状态"、"类型"、"来源"、"渠道"等 → `VARCHAR(255)`
   - 字段名包含"图片"、"照片" → `VARCHAR(200)` + `stdDomain="image"`
   - 字段名包含"文件"、"附件" → `VARCHAR(200)` + `stdDomain="file"`

3. **搜索字段辅助**：
   - 如果搜索字段的 `type` 为 `date`，对应的表格列是日期类型
   - 如果搜索字段的 `type` 为 `select`，对应的表格列可能是文本类型

## 八、输出要求

1. 生成的 XML 必须符合 `references/orm.xdef` 规范
2. 所有必填属性必须设置
3. 字段顺序：主键 → 业务字段（按输入顺序）→ 系统字段（addTime, updateTime, deleted）
4. 代码格式：每个属性单独一行，缩进对齐
5. 必须添加 `<comment>` 注释标签
6. 只输出单个 `<entity>...</entity>` 片段，不要 XML 头、`<orm>`、`<entities>` 包裹
7. entity 标签必须包含 `className`, `createTimeProp`, `updateTimeProp`, `deleteFlagProp`, `useLogicalDelete`, `i18n-en:displayName` 属性