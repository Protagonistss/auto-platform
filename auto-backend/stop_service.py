#!/usr/bin/env python3
"""
停止 Quarkus 开发服务器的独立脚本
可以直接运行，不依赖后端 API
"""
import subprocess
import sys
import platform

def stop_service(port: int = 8080):
    """停止占用指定端口的进程"""
    print(f"正在停止端口 {port} 的服务...")

    try:
        if platform.system() == 'Windows':
            # Windows: 使用 netstat 和 taskkill
            # 查找占用端口的进程
            result = subprocess.run(
                f"netstat -ano | findstr :{port}",
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0 and result.stdout:
                pids = set()
                for line in result.stdout.strip().split('\n'):
                    if 'LISTENING' in line:
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            pids.add(pid)

                if pids:
                    print(f"找到占用端口的进程: {pids}")
                    for pid in pids:
                        # 杀死进程
                        kill_result = subprocess.run(
                            f"taskkill /F /PID {pid}",
                            shell=True,
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        if kill_result.returncode == 0:
                            print(f"✓ 已杀死进程 PID: {pid}")
                        else:
                            print(f"✗ 杀死进程 PID {pid} 失败")
                            print(kill_result.stderr)

                    print(f"\n服务已停止，端口 {port} 已释放")
                else:
                    print(f"端口 {port} 没有被占用")
            else:
                print(f"端口 {port} 没有被占用")

        else:
            # Linux/Mac: 使用 lsof 或 fuser
            result = subprocess.run(
                f"fuser -k {port}/tcp",
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            print(f"服务已停止，端口 {port} 已释放")

        return True

    except subprocess.TimeoutExpired:
        print("✗ 操作超时")
        return False
    except Exception as e:
        print(f"✗ 停止服务失败: {e}")
        return False

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    success = stop_service(port)
    sys.exit(0 if success else 1)
