from typing import Dict, Optional
from ..models.task import Task


class TaskStore:
    def __init__(self):
        self._store: Dict[str, Task] = {}

    def save(self, task: Task) -> None:
        self._store[task.task_id] = task

    def get(self, task_id: str) -> Optional[Task]:
        return self._store.get(task_id)

    def list_all(self) -> list[Task]:
        return list(self._store.values())

    def delete(self, task_id: str) -> bool:
        if task_id in self._store:
            del self._store[task_id]
            return True
        return False
