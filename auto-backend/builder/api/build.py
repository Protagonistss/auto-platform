"""构建命令执行 API"""

import json
import time
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from ..models.task import BuildCommandRequest, BuildCommandResponse
from ..services.shell_service import ShellService
from ..services.process_manager import process_manager
from ..config import settings
from pydantic import BaseModel

router = APIRouter()
shell_service = ShellService()

# 存储活跃的流式任务
active_streams: dict = {}


class ExportExcelRequest(BaseModel):
    """导出 Excel 请求"""
    output_name: str = "app.orm.xlsx"  # 输出文件名


@router.post(
    "/execute",
    response_model=BuildCommandResponse,
    summary="执行构建命令",
    description="异步执行 Maven/npm/Gradle 等构建命令并返回结果（非流式）"
)
async def execute_build(request: BuildCommandRequest):
    """
    执行构建命令（非流式）

    支持的构建类型：
    - **maven**: Maven 命令（如 'mvn clean install'）
    - **npm**: npm 命令（如 'npm run build'）
    - **gradle**: Gradle 命令（如 'gradle build'）
    - **custom**: 自定义命令

    参数：
    - **command**: 构建命令字符串
    - **cwd**: 工作目录（可选，默认为项目根目录）
    - **timeout**: 超时时间（秒），默认 300 秒
    - **command_type**: 命令类型标识
    """
    import logging
    logger = logging.getLogger(__name__)

    # 安全验证：防止命令注入
    _validate_command(request.command)

    # 设置默认工作目录
    cwd = request.cwd or settings.project_root

    logger.info(f"执行构建命令: {request.command} | cwd: {cwd} | timeout: {request.timeout}")

    # 执行构建（收集所有输出）
    start_time = time.time()
    output_lines = []

    try:
        async for line in shell_service.run_command_stream(
            command=request.command,
            cwd=cwd,
            timeout=request.timeout
        ):
            output_lines.append(line)

        execution_time = time.time() - start_time

        logger.info(f"命令执行成功，耗时 {execution_time:.2f}s，输出行数: {len(output_lines)}")

        return BuildCommandResponse(
            success=True,
            command=request.command,
            exit_code=0,
            stdout='\n'.join(output_lines),
            stderr="",
            execution_time=execution_time,
            message="构建成功"
        )

    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"命令执行失败: {str(e)}", exc_info=True)
        return BuildCommandResponse(
            success=False,
            command=request.command,
            exit_code=-1,
            stdout="",
            stderr=str(e),
            execution_time=execution_time,
            message=f"构建失败: {str(e)}"
        )


@router.post(
    "/stop",
    summary="停止构建服务",
    description="停止运行中的构建服务（通过杀死指定端口的进程）"
)
async def stop_service(port: int = 8080):
    """
    停止指定端口的服务

    参数：
    - **port**: 要停止的端口号，默认 8080
    """
    import logging
    import subprocess
    import platform
    import asyncio
    from fastapi import BackgroundTasks
    logger = logging.getLogger(__name__)

    logger.info(f"收到停止服务请求，端口: {port}")

    # 使用后台任务执行停止操作，立即返回
    def stop_port_process():
        try:
            if platform.system() == 'Windows':
                # Windows: 使用 taskkill 杀死占用端口的进程
                # 先查找占用端口的进程 PID
                find_cmd = f"netstat -ano | findstr :{port}"
                result = subprocess.run(
                    find_cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                if result.returncode == 0 and result.stdout:
                    # 解析 PID
                    for line in result.stdout.strip().split('\n'):
                        if 'LISTENING' in line:
                            parts = line.split()
                            if len(parts) >= 5:
                                pid = parts[-1]
                                # 杀死进程
                                kill_cmd = f"taskkill /F /PID {pid}"
                                subprocess.run(kill_cmd, shell=True, capture_output=True, timeout=10)
                                logger.info(f"已杀死进程 PID: {pid}")

            else:
                # Linux/Mac: 使用 lsof 和 kill
                subprocess.run(f"fuser -k {port}/tcp", shell=True, timeout=10)
                logger.info(f"已停止端口 {port} 的服务")

        except Exception as e:
            logger.error(f"停止服务失败: {str(e)}")

    # 在后台线程中执行停止操作
    import threading
    thread = threading.Thread(target=stop_port_process, daemon=True)
    thread.start()

    # 立即返回
    return {"success": True, "message": f"正在停止端口 {port} 的服务..."}


@router.post(
    "/export/excel",
    summary="导出 Excel",
    description="通过 nop-cli.jar 生成 Excel 文件并下载"
)
async def export_excel(request: ExportExcelRequest):
    """
    导出 ORM 配置到 Excel（非流式）

    参数：
    - **output_name**: 输出文件名（默认 app.orm.xlsx）

    返回：Excel 文件下载
    """
    import logging
    import subprocess
    from pathlib import Path
    logger = logging.getLogger(__name__)

    logger.info(f"=== 导出 Excel ===")
    logger.info(f"输出文件: {request.output_name}")

    try:
        # 当前后端项目目录（auto-backend）
        backend_dir = Path(__file__).parent.parent.parent

        # nop-cli.jar 路径（在 auto-backend/scripts 中）
        jar_path = backend_dir / "scripts" / "nop-cli.jar"

        if not jar_path.exists():
            raise HTTPException(status_code=404, detail=f"nop-cli.jar 不存在: {jar_path}")

        # 项目工作目录（labor-tracking-system）
        project_dir = Path(settings.project_root)

        # 从配置获取 XML 文件路径
        xml_path = Path(settings.orm_xml_path)
        if not xml_path.exists():
            raise HTTPException(status_code=404, detail=f"XML 文件不存在: {xml_path}")

        # 计算相对于项目根目录的路径
        try:
            xml_relative_path = xml_path.relative_to(project_dir)
        except ValueError:
            # 如果不在项目根目录下，使用绝对路径
            xml_relative_path = xml_path

        logger.info(f"nop-cli.jar: {jar_path}")
        logger.info(f"XML 文件路径: {xml_relative_path}")
        logger.info(f"工作目录: {project_dir}")

        # 输出文件路径（生成在项目根目录）
        output_path = project_dir / request.output_name

        # 构建命令
        command = [
            "java",
            "-jar",
            str(jar_path),
            "gen-file",
            "-t",
            "/nop/orm/imp/orm.imp.xml",
            "-o",
            request.output_name,
            str(xml_relative_path)
        ]

        logger.info(f"执行命令: {' '.join(command)}")

        # 执行命令
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300,  # 5分钟超时
            cwd=str(project_dir)
        )

        logger.info(f"命令执行完成，退出码: {result.returncode}")
        if result.stdout:
            logger.info(f"stdout: {result.stdout}")
        if result.stderr:
            logger.warning(f"stderr: {result.stderr}")

        # 检查输出文件是否生成
        if not output_path.exists():
            logger.error("输出文件未生成")
            raise HTTPException(
                status_code=500,
                detail=f"Excel 生成失败。命令输出: {result.stdout}, 错误: {result.stderr}"
            )

        logger.info(f"返回文件: {output_path}")

        # 返回文件下载
        return FileResponse(
            path=str(output_path),
            filename=request.output_name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except subprocess.TimeoutExpired:
        logger.error("命令执行超时")
        raise HTTPException(status_code=408, detail="命令执行超时")

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"导出 Excel 失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.post(
    "/export/excel/stream",
    summary="流式导出 Excel",
    description="通过 nop-cli.jar 生成 Excel 文件，实时返回输出日志"
)
async def export_excel_stream(request: ExportExcelRequest):
    """
    流式导出 ORM 配置到 Excel（SSE）

    返回 Server-Sent Events 格式的流式数据：
    - data: {"type": "log", "line": "输出行"}
    - data: {"type": "complete", "success": true/false, "message": "...", "output_name": "文件名"}

    参数：
    - **output_name**: 输出文件名（默认 app.orm.xlsx）
    """
    import logging
    import subprocess
    from pathlib import Path
    logger = logging.getLogger(__name__)

    logger.info(f"=== 流式导出 Excel ===")
    logger.info(f"输出文件: {request.output_name}")

    # 当前后端项目目录（auto-backend）
    backend_dir = Path(__file__).parent.parent.parent

    # nop-cli.jar 路径
    jar_path = backend_dir / "scripts" / "nop-cli.jar"

    if not jar_path.exists():
        async def error_gen():
            yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': f'nop-cli.jar 不存在: {jar_path}'}, ensure_ascii=False)}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    # 项目工作目录
    project_dir = Path(settings.project_root)

    # 从配置获取 XML 文件路径
    xml_path = Path(settings.orm_xml_path)
    if not xml_path.exists():
        async def error_gen():
            yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': f'XML 文件不存在: {xml_path}'}, ensure_ascii=False)}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    # 计算相对路径
    try:
        xml_relative_path = xml_path.relative_to(project_dir)
    except ValueError:
        xml_relative_path = xml_path

    logger.info(f"nop-cli.jar: {jar_path}")
    logger.info(f"XML 文件路径: {xml_relative_path}")
    logger.info(f"工作目录: {project_dir}")

    # 输出文件路径
    output_path = project_dir / request.output_name

    # 构建命令
    command = [
        "java",
        "-jar",
        str(jar_path),
        "gen-file",
        "-t",
        "/nop/orm/imp/orm.imp.xml",
        "-o",
        request.output_name,
        str(xml_relative_path)
    ]

    logger.info(f"执行命令: {' '.join(command)}")

    async def event_generator():
        """SSE 事件生成器"""
        success = True
        error_message = "导出成功"

        try:
            # 使用 shell_service 的流式方法（直接传递命令列表）
            async for line in shell_service.run_command_stream(
                command=command,
                cwd=str(project_dir),
                timeout=300
            ):
                # 发送日志行
                yield f"data: {json.dumps({'type': 'log', 'line': line}, ensure_ascii=False)}\n\n"

        except GeneratorExit:
            logger.warning("客户端断开连接，停止导出")
            success = False
            error_message = "客户端断开连接"
            raise

        except Exception as e:
            success = False
            error_message = str(e)
            try:
                yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': error_message}, ensure_ascii=False)}\n\n"
            except:
                pass
            return

        # 检查文件是否生成成功
        if success:
            if output_path.exists():
                # 导出成功，返回文件名
                try:
                    yield f"data: {json.dumps({'type': 'complete', 'success': True, 'message': 'Excel 导出成功', 'output_name': request.output_name}, ensure_ascii=False)}\n\n"
                except:
                    pass
            else:
                # 文件未生成
                try:
                    yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': 'Excel 文件生成失败'}, ensure_ascii=False)}\n\n"
                except:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get(
    "/export/excel/download",
    summary="下载导出的 Excel 文件",
    description="下载已生成的 Excel 文件"
)
async def download_excel(filename: str = "app.orm.xlsx"):
    """
    下载 Excel 文件

    参数：
    - **filename**: 文件名
    """
    import logging
    from pathlib import Path
    logger = logging.getLogger(__name__)

    try:
        # 项目工作目录
        project_dir = Path(settings.project_root)
        file_path = project_dir / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"文件不存在: {filename}")

        logger.info(f"下载文件: {file_path}")

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")


@router.post(
    "/execute/stream",
    summary="流式执行构建命令",
    description="流式执行 Maven/npm/Gradle 等构建命令，通过 SSE 实时返回输出"
)
async def execute_build_stream(request: BuildCommandRequest):
    """
    流式执行构建命令（SSE）

    返回 Server-Sent Events 格式的流式数据：
    - data: {"type": "log", "line": "输出行"}
    - data: {"type": "complete", "success": true/false, "message": "..."}

    参数：
    - **command**: 构建命令字符串
    - **cwd**: 工作目录（可选，默认为项目根目录）
    - **timeout**: 超时时间（秒），默认 300 秒
    - **command_type**: 命令类型标识
    """
    import logging
    logger = logging.getLogger(__name__)

    # 安全验证：防止命令注入
    _validate_command(request.command)

    # 设置默认工作目录
    cwd = request.cwd or settings.project_root

    logger.info(f"=== 流式执行构建命令 ===")
    logger.info(f"命令: {request.command}")
    logger.info(f"工作目录: {cwd}")
    logger.info(f"超时: {request.timeout}秒")

    async def event_generator():
        """SSE 事件生成器"""
        command_success = True
        error_message = "构建成功"
        exit_code = 0

        try:
            async for line in shell_service.run_command_stream(
                command=request.command,
                cwd=cwd,
                timeout=request.timeout
            ):
                # 检查是否是特殊的退出码行
                if line.startswith("__BUILD_EXIT_CODE:"):
                    exit_code = int(line.split("__BUILD_EXIT_CODE:")[1].split("__")[0])
                    command_success = (exit_code == 0)
                    error_message = f"命令执行完成 (退出码: {exit_code})" if command_success else f"命令执行失败 (退出码: {exit_code})"
                else:
                    # 发送日志行
                    yield f"data: {json.dumps({'type': 'log', 'line': line}, ensure_ascii=False)}\n\n"

                # 检查客户端是否断开（yield 会触发断开检测）
                # 如果客户端断开，下一次循环时 GeneratorExit 会被触发

        except GeneratorExit:
            # 客户端断开连接
            logger.warning("客户端断开连接，停止流式输出")
            command_success = False
            error_message = "客户端断开连接"
            raise

        except Exception as e:
            # 执行过程中发生异常（如超时）
            command_success = False
            error_message = str(e)
            # 发送错误事件
            try:
                yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': error_message}, ensure_ascii=False)}\n\n"
            except:
                pass  # 客户端可能已经断开
            return

        # 发送完成事件
        try:
            yield f"data: {json.dumps({'type': 'complete', 'success': command_success, 'message': error_message}, ensure_ascii=False)}\n\n"
        except:
            pass  # 客户端可能已经断开

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _validate_command(command: str) -> None:
    """
    验证命令安全性，防止命令注入

    Args:
        command: 命令字符串

    Raises:
        HTTPException: 命令不安全时抛出
    """
    # 危险字符黑名单
    dangerous_chars = ['|', '&', ';', '$', '`', '(', ')', '<', '>']

    for char in dangerous_chars:
        if char in command:
            raise HTTPException(
                status_code=400,
                detail=f"命令包含非法字符: {char}，可能存在命令注入风险"
            )
