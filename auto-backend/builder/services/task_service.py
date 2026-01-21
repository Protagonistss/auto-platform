import asyncio
import logging
from datetime import datetime
from ..models.task import Task, TaskStatus, OrmGenerationResult
from .ai_service import AIService
from .parser import OrmXmlParser
from ..storage.task_store import TaskStore

logger = logging.getLogger(__name__)


class TaskService:
    def __init__(self, store: TaskStore):
        self.store = store
        self.ai_service = AIService()
        self.parser = OrmXmlParser()

    async def submit_task(self, file_name: str, content: str) -> str:
        """提交任务并立即返回 task_id"""
        task = Task(file_name=file_name)
        self.store.save(task)

        # 后台异步处理
        asyncio.create_task(self._process_task(task.task_id, content))

        logger.info(f"任务已提交: {task.task_id}, 文件: {file_name}")
        return task.task_id

    async def get_task(self, task_id: str) -> Task | None:
        """查询任务状态"""
        return self.store.get(task_id)

    async def _process_task(self, task_id: str, content: str):
        """后台处理任务（核心解耦逻辑）"""
        task = self.store.get(task_id)
        if not task:
            return

        try:
            # 更新状态为处理中
            task.status = TaskStatus.PROCESSING
            self.store.save(task)
            logger.info(f"开始处理任务: {task_id}")

            # 调用 AI 生成
            ai_response = self.ai_service.generate_orm(content)
            logger.info(f"AI 响应完成: {task_id}, 响应长度: {len(ai_response)}")

            # 解析 XML
            result = self.parser.parse(ai_response)

            # 更新结果
            task.status = TaskStatus.SUCCESS
            task.result = result
            task.completed_at = datetime.utcnow()
            self.store.save(task)
            logger.info(f"任务处理成功: {task_id}")

        except Exception as e:
            # 错误处理
            logger.error(f"任务处理失败: {task_id}, 错误: {e}", exc_info=True)
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()
            self.store.save(task)
