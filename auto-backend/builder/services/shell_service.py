import asyncio
import logging
import os
import platform
import shlex
import subprocess
import threading
import queue
from pathlib import Path
from typing import List, Union, Optional, AsyncIterator

logger = logging.getLogger(__name__)


class ShellService:
    """Shell 命令执行服务"""

    async def run_command_stream(
        self,
        command: Union[str, List[str]],
        cwd: Optional[Union[str, Path]] = None,
        timeout: Optional[int] = None
    ) -> AsyncIterator[str]:
        """
        流式执行 Shell 命令，逐行返回输出

        Args:
            command: 命令字符串 (如 'mvn clean') 或列表 (如 ['mvn', 'clean'])
            cwd: 执行命令的工作目录
            timeout: 超时时间（秒）

        Yields:
            str: 命令的输出行

        Raises:
            FileNotFoundError: 指定的工作目录不存在
            RuntimeError: 命令执行失败 (非0退出码)
            asyncio.TimeoutError: 命令执行超时
        """
        # 1. 处理命令参数
        if isinstance(command, str):
            cmd_args = shlex.split(command)
        else:
            cmd_args = command

        # 2. 处理工作目录
        if cwd:
            cwd_path = Path(cwd)
            if not cwd_path.exists():
                raise FileNotFoundError(f"工作目录不存在: {cwd}")
            cwd_str = str(cwd_path)
        else:
            cwd_str = None

        # Windows 上批处理命令需要 shell=True
        is_windows = platform.system() == 'Windows'
        batch_commands = ['mvn', 'npm', 'gradle', 'yarn', 'pnpm', 'npx']
        use_shell = is_windows and cmd_args and cmd_args[0] in batch_commands

        logger.info(f"流式执行命令: {' '.join(cmd_args)} | 目录: {cwd_str or '.'} | shell: {use_shell}")

        # 使用队列在线程和异步代码之间传递数据
        output_queue: queue.Queue[str] = queue.Queue()
        result_queue: queue.Queue[dict] = queue.Queue()
        stop_event = threading.Event()  # 添加停止事件

        # 在线程中运行命令
        process_ref = [None]  # 使用列表存储进程引用，以便在闭包中修改

        def run_in_thread():
            try:
                process = subprocess.Popen(
                    cmd_args if not use_shell else ' '.join(cmd_args),
                    cwd=cwd_str,
                    shell=use_shell,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    bufsize=1  # 行缓冲
                )
                process_ref[0] = process  # 保存进程引用

                # 逐行读取输出
                for line in iter(process.stdout.readline, ''):
                    if line:
                        output_queue.put(line.rstrip())

                process.wait()

                result_queue.put({
                    'returncode': process.returncode,
                    'success': process.returncode == 0
                })

            except Exception as e:
                logger.error(f"线程中执行命令异常: {str(e)}")
                result_queue.put({
                    'returncode': -1,
                    'success': False,
                    'error': str(e)
                })

        # 启动线程
        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()

        try:
            # 从队列中读取输出并 yield
            start_time = asyncio.get_event_loop().time()

            while thread.is_alive():
                try:
                    line = output_queue.get(timeout=0.1)
                    yield line

                    # 检查超时
                    if timeout:
                        elapsed = asyncio.get_event_loop().time() - start_time
                        if elapsed > timeout:
                            raise TimeoutError(f"命令执行超时 ({timeout}s)")

                    # 让出控制权，允许事件循环处理其他请求
                    await asyncio.sleep(0)

                except queue.Empty:
                    # 检查超时
                    if timeout:
                        elapsed = asyncio.get_event_loop().time() - start_time
                        if elapsed > timeout:
                            raise TimeoutError(f"命令执行超时 ({timeout}s)")

                    # 队列为空时，也让出控制权
                    await asyncio.sleep(0)
                    continue

            # 获取最终结果
            result = result_queue.get(timeout=1)

            if not result['success']:
                # 命令执行失败，但输出已经通过 yield 返回了
                # 发送一个特殊的退出码行，让调用者知道命令失败
                returncode = result.get('returncode', -1)
                logger.warning(f"命令执行失败 (Exit Code: {returncode})，输出已返回")
                yield f"__BUILD_EXIT_CODE:{returncode}__"
            else:
                # 命令成功，发送退出码 0
                yield f"__BUILD_EXIT_CODE:0__"

            logger.info("流式命令执行完成")

        except GeneratorExit:
            # 客户端断开连接，清理进程
            logger.warning("客户端断开连接，正在终止进程...")
            if process_ref[0]:
                try:
                    process_ref[0].terminate()
                    # 等待进程结束，最多等待 3 秒
                    try:
                        process_ref[0].wait(timeout=3)
                    except:
                        # 如果进程没有终止，强制杀死
                        logger.warning("进程未能正常终止，强制杀死")
                        process_ref[0].kill()
                    logger.info("进程已终止")
                except Exception as e:
                    logger.error(f"终止进程时出错: {str(e)}")
            raise

        except TimeoutError as e:
            # 超时，也要清理进程
            logger.error(str(e))
            if process_ref[0]:
                try:
                    process_ref[0].kill()
                    logger.info("进程因超时被杀死")
                except Exception as e:
                    logger.error(f"杀死超时进程时出错: {str(e)}")
            raise

        except Exception as e:
            import traceback
            logger.error(f"流式命令执行异常:\n{traceback.format_exc()}")
            raise

    async def run_command(
        self,
        command: Union[str, List[str]],
        cwd: Optional[Union[str, Path]] = None,
        timeout: Optional[int] = None
    ) -> str:
        """
        异步执行 Shell 命令（非流式，等待完成后返回全部输出）

        Args:
            command: 命令字符串 (如 'mvn clean') 或列表 (如 ['mvn', 'clean'])
            cwd: 执行命令的工作目录
            timeout: 超时时间（秒）

        Returns:
            str: 命令的标准输出 (stdout)

        Raises:
            FileNotFoundError: 指定的工作目录不存在
            RuntimeError: 命令执行失败 (非0退出码)
            asyncio.TimeoutError: 命令执行超时
        """
        output_lines = []
        async for line in self.run_command_stream(command, cwd, timeout):
            output_lines.append(line)
        return '\n'.join(output_lines)
