from fastapi import APIRouter, UploadFile, File, HTTPException
from ..models.task import TaskSubmitResponse, Task, TaskStatus, OrmGenerationResult
from ..services.task_service import TaskService
from ..storage.task_store import TaskStore

router = APIRouter()
task_store = TaskStore()
task_service = TaskService(task_store)


@router.post(
    "/upload",
    response_model=TaskSubmitResponse,
    summary="上传配置文件",
    description="上传 JSON 格式的配置文件，异步生成 MyBatis ORM 实体"
)
async def upload_config(file: UploadFile = File(..., description="JSON 配置文件")):
    """
    上传 JSON 配置文件，返回任务 ID 用于后续查询

    - **file**: JSON 格式配置文件（.json）
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="仅支持 JSON 格式文件")

    content = await file.read()
    content_str = content.decode("utf-8")

    task_id = await task_service.submit_task(file.filename, content_str)

    return TaskSubmitResponse(task_id=task_id)


@router.get(
    "/tasks/{task_id}",
    response_model=Task,
    summary="查询任务状态",
    description="根据任务 ID 查询执行状态和详细信息"
)
async def get_task_status(task_id: str):
    """
    查询任务状态

    - **task_id**: 任务唯一标识符
    - 返回任务完整信息，包括状态、进度、结果等
    """
    task = await task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return task


@router.get(
    "/tasks/{task_id}/result",
    response_model=OrmGenerationResult,
    summary="获取生成结果",
    description="获取已成功完成任务的生成结果"
)
async def get_result(task_id: str):
    """
    获取生成结果（仅成功时可用）

    - **task_id**: 任务唯一标识符
    - 仅当任务状态为 success 时可获取结果
    """
    task = await task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != TaskStatus.SUCCESS:
        raise HTTPException(
            status_code=400,
            detail=f"任务未完成，当前状态: {task.status.value}"
        )

    return task.result
