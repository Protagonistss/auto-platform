import asyncio
import logging
import os
import platform
import shlex
import subprocess
import threading
import queue
import shutil
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

        使用线程 + subprocess.Popen 实现，兼容 Windows 和 uvicorn。

        Args:
            command: 命令字符串 (如 'mvn clean') 或列表 (如 ['mvn', 'clean'])
            cwd: 执行命令的工作目录
            timeout: 超时时间（秒）

        Yields:
            str: 命令的输出行
        """
        # 1. 处理命令
        if isinstance(command, str):
            command_str = command
        else:
            command_str = ' '.join(command)

        # 2. 处理工作目录
        if cwd:
            cwd_path = Path(cwd)
            if not cwd_path.exists():
                raise FileNotFoundError(f"工作目录不存在: {cwd}")
            cwd_str = str(cwd_path)
        else:
            cwd_str = None

        is_windows = platform.system() == 'Windows'

        logger.info(f"执行命令: {command_str} | 目录: {cwd_str or '.'} | Windows: {is_windows}")

        # 使用队列在线程和异步代码之间传递数据
        output_queue: queue.Queue = queue.Queue()
        process_holder = [None]  # 用于存储进程引用

        def run_in_thread():
            """在线程中执行命令"""
            try:
                # Windows 上解析可执行文件路径，避免使用 shell=True
                if is_windows:
                    # 解析命令
                    parts = shlex.split(command_str, posix=False)
                    cmd_exe = parts[0]

                    # 查找可执行文件
                    executable = shutil.which(cmd_exe)
                    if not executable:
                        raise FileNotFoundError(f"找不到命令: {cmd_exe}")

                    # 使用可执行文件的完整路径
                    parts[0] = executable

                    logger.info(f"使用可执行文件: {executable}")

                    # 设置环境变量以禁用 Python 缓冲
                    env = os.environ.copy()
                    env['PYTHONUNBUFFERED'] = '1'

                    # 检查是否是 .cmd 或 .bat 文件
                    is_batch = executable.lower().endswith(('.cmd', '.bat'))
                    if is_batch:
                        logger.warning(f"检测到批处理文件 {executable}，可能仍有缓冲问题")

                    # 不使用 shell=True，直接执行
                    process = subprocess.Popen(
                        parts,
                        cwd=cwd_str,
                        shell=False,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        bufsize=0,  # 无缓冲
                        env=env
                    )
                else:
                    cmd_args = shlex.split(command_str)
                    process = subprocess.Popen(
                        cmd_args,
                        cwd=cwd_str,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        bufsize=0,
                    )

                process_holder[0] = process
                logger.info(f"进程启动成功，PID: {process.pid}")

                # 添加调试日志
                read_count = 0
                last_log_time = 0

                # 逐字节读取并按行输出
                buffer = b''
                while True:
                    # 读取一个字节
                    byte = process.stdout.read(1)
                    if not byte:
                        logger.info(f"stdout.read(1) 返回空，进程可能已结束 (已读取 {read_count} 字节)")
                        break

                    read_count += 1

                    # 每读取 1000 字节记录一次
                    if read_count % 1000 == 0:
                        logger.info(f"已读取 {read_count} 字节...")

                    buffer += byte

                    # 检查是否有完整的行
                    if byte == b'\n' or byte == b'\r':
                        if buffer.strip():
                            line = self._decode_bytes(buffer)
                            if line:
                                logger.info(f"收到日志行: {line[:100]}...")
                                output_queue.put(('line', line))
                        buffer = b''

                # 处理剩余的缓冲区
                if buffer.strip():
                    line = self._decode_bytes(buffer)
                    if line:
                        output_queue.put(('line', line))

                process.wait()
                output_queue.put(('done', process.returncode))
                logger.info(f"进程结束，退出码: {process.returncode}，共读取 {read_count} 字节")

            except Exception as e:
                logger.error(f"线程执行异常: {e}")
                import traceback
                logger.error(traceback.format_exc())
                output_queue.put(('error', str(e)))

        # 启动线程
        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()

        import time
        start_time = time.monotonic()

        try:
            while True:
                # 检查超时
                if timeout:
                    elapsed = time.monotonic() - start_time
                    if elapsed > timeout:
                        if process_holder[0]:
                            process_holder[0].kill()
                        raise TimeoutError(f"命令执行超时 ({timeout}s)")

                # 尝试从队列获取数据
                try:
                    msg_type, data = output_queue.get(timeout=0.1)

                    if msg_type == 'line':
                        yield data
                        await asyncio.sleep(0)  # 让出控制权
                    elif msg_type == 'done':
                        # 进程结束
                        yield f"__BUILD_EXIT_CODE:{data}__"
                        break
                    elif msg_type == 'error':
                        raise RuntimeError(data)

                except queue.Empty:
                    # 队列为空，检查线程是否还活着
                    if not thread.is_alive():
                        # 线程已结束，尝试获取剩余消息
                        try:
                            while True:
                                msg_type, data = output_queue.get_nowait()
                                if msg_type == 'line':
                                    yield data
                                elif msg_type == 'done':
                                    yield f"__BUILD_EXIT_CODE:{data}__"
                                elif msg_type == 'error':
                                    raise RuntimeError(data)
                        except queue.Empty:
                            pass
                        break
                    await asyncio.sleep(0)

        except GeneratorExit:
            logger.warning("客户端断开连接，终止进程...")
            if process_holder[0]:
                try:
                    process_holder[0].terminate()
                    process_holder[0].wait(timeout=3)
                except:
                    try:
                        process_holder[0].kill()
                    except:
                        pass
            raise

        except TimeoutError:
            logger.error(f"命令执行超时 ({timeout}s)")
            raise

        except Exception as e:
            logger.error(f"流式命令执行异常: {e}")
            import traceback
            logger.error(traceback.format_exc())
            if process_holder[0]:
                try:
                    process_holder[0].kill()
                except:
                    pass
            raise

    def _decode_bytes(self, data: bytes) -> str:
        """解码字节数据"""
        data = data.strip()
        if not data:
            return ''

        # 尝试不同的编码
        for encoding in ['utf-8', 'gbk', 'cp936', 'latin-1']:
            try:
                return data.decode(encoding)
            except UnicodeDecodeError:
                continue

        return data.decode('utf-8', errors='replace')

    async def run_command(
        self,
        command: Union[str, List[str]],
        cwd: Optional[Union[str, Path]] = None,
        timeout: Optional[int] = None
    ) -> str:
        """
        异步执行 Shell 命令（非流式）
        """
        output_lines = []
        async for line in self.run_command_stream(command, cwd, timeout):
            if not line.startswith("__BUILD_EXIT_CODE:"):
                output_lines.append(line)
        return '\n'.join(output_lines)
