"""进程管理器 - 跟踪和控制运行中的构建进程"""
import subprocess
import threading
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class ProcessManager:
    """管理运行中的构建进程"""

    def __init__(self):
        self._processes: Dict[str, subprocess.Popen] = {}
        self._lock = threading.Lock()

    def register(self, task_id: str, process: subprocess.Popen) -> None:
        """注册进程"""
        with self._lock:
            self._processes[task_id] = process
            logger.info(f"注册进程: {task_id} (PID: {process.pid})")

    def unregister(self, task_id: str) -> None:
        """注销进程"""
        with self._lock:
            if task_id in self._processes:
                del self._processes[task_id]
                logger.info(f"注销进程: {task_id}")

    def stop_process(self, task_id: str) -> bool:
        """停止指定任务ID的进程"""
        with self._lock:
            if task_id not in self._processes:
                logger.warning(f"进程不存在: {task_id}")
                return False

            process = self._processes[task_id]

            try:
                # 先尝试优雅终止
                process.terminate()
                try:
                    process.wait(timeout=3)
                except:
                    # 强制杀死
                    process.kill()

                logger.info(f"进程已停止: {task_id} (PID: {process.pid})")
                del self._processes[task_id]
                return True

            except Exception as e:
                logger.error(f"停止进程失败: {task_id}, 错误: {e}")
                return False

    def stop_all(self) -> None:
        """停止所有进程"""
        with self._lock:
            for task_id, process in list(self._processes.items()):
                try:
                    process.kill()
                    logger.info(f"强制停止进程: {task_id}")
                except Exception as e:
                    logger.error(f"停止进程失败: {task_id}, 错误: {e}")

            self._processes.clear()


# 全局进程管理器实例
process_manager = ProcessManager()
