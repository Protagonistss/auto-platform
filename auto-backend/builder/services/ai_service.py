from zhipuai import ZhipuAI
from ..config import settings
from pathlib import Path
from typing import List, Dict, Iterator


class AIService:
    def __init__(self):
        self.client = ZhipuAI(api_key=settings.zhipu_api_key)

    def generate_orm(self, config_content: str) -> str:
        """调用智谱 AI 生成 ORM"""
        prompt = self._build_prompt(config_content)

        response = self.client.chat.completions.create(
            model=settings.ai_model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        return response.choices[0].message.content

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.7, use_system_prompt: bool = False) -> str:
        """通用对话接口"""
        full_messages = []

        # 添加系统提示词
        if use_system_prompt:
            system_prompt = self._load_system_prompt()
            full_messages.append({"role": "system", "content": system_prompt})

        # 添加对话历史
        full_messages.extend(messages)

        response = self.client.chat.completions.create(
            model=settings.ai_model,
            messages=full_messages,
            temperature=temperature,
            max_tokens=4096,
        )

        return response.choices[0].message.content

    def _load_system_prompt(self, enable_thinking: bool = False) -> str:
        """加载系统提示词模板"""
        if enable_thinking:
            # 思考模式：简洁的思考指令
            return """你是一个AI助手。回答问题时请先思考分析，然后给出答案。

思考部分用<thinking>标签包裹，格式如下：
<thinking>
分析问题的关键点和解决思路
</thinking>

然后给出你的最终答案。"""

        # 非思考模式：加载orm.md文件并注入配置
        prompt_path = Path(__file__).parent.parent / "prompts" / "orm.md"
        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt = f.read()

        # 注入配置
        config_vars = {
            "{{DEFAULT_PACKAGE}}": settings.orm_default_package,
            "{{TABLE_PREFIX}}": settings.orm_table_prefix,
        }

        for var, value in config_vars.items():
            prompt = prompt.replace(var, value)

        return prompt

    def _build_prompt(self, config_content: str) -> str:
        """构建完整提示词"""
        prompt_path = Path(__file__).parent.parent / "prompts" / "orm.md"
        with open(prompt_path, "r", encoding="utf-8") as f:
            template = f.read()

        return f"{template}\n\n输入配置:\n{config_content}"

    def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        use_system_prompt: bool = False,
        enable_thinking: bool = False
    ) -> Iterator[tuple[str, bool | None]]:
        """
        流式对话接口 - 返回文本生成器（支持思考模式）

        Args:
            messages: 对话历史
            temperature: 温度参数
            use_system_prompt: 是否使用系统提示词
            enable_thinking: 是否启用思考模式（使用 GLM 原生 thinking 参数）

        Yields:
            tuple[str, bool | None]: (文本片段, 是否为思考内容)
        """
        # 构建完整消息列表
        full_messages = []

        # 始终加载系统提示词（包含 XML 输出格式要求）
        if use_system_prompt:
            system_prompt = self._load_system_prompt()
            full_messages.append({"role": "system", "content": system_prompt})

        full_messages.extend(messages)

        # 构建请求参数
        request_params = {
            "model": settings.ai_model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": 4096,
            "stream": True,
        }

        # 如果启用思考模式，添加 GLM 原生 thinking 参数
        if enable_thinking:
            request_params["thinking"] = {
                "type": "enabled",
                "clear_thinking": True
            }

        # 调试日志
        import sys
        print(f"[DEBUG] 请求参数 thinking={enable_thinking}", flush=True)
        print(f"[DEBUG] 完整参数: {request_params}", flush=True)

        try:
            # 调用智谱AI流式接口
            response = self.client.chat.completions.create(**request_params)

            # 迭代返回增量文本
            for chunk in response:
                if chunk.choices:
                    delta = chunk.choices[0].delta

                    # 在思考模式下，检查是否有推理内容
                    if enable_thinking and hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                        yield (delta.reasoning_content, True)

                    # 检查是否有普通内容（最终答案）
                    if hasattr(delta, 'content') and delta.content:
                        yield (delta.content, False)

        except Exception as e:
            # 错误处理：yield错误信息
            yield (f"\n[错误] {str(e)}", None)
            raise
