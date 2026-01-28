import { useState, useCallback, useRef, useEffect } from 'react'
import { chatApi } from '@/services/chatApi'
import type { BuildCommandResponse } from '@/services/chatApi'
import type { BuildOperationState, BuildOperationCallbacks } from '@/types/build'

/**
 * 构建操作 Hook
 * 处理构建、写入、启动服务、停止服务、导出等操作
 */
export function useBuildOperation(callbacks?: BuildOperationCallbacks) {
  const LOG_FLUSH_INTERVAL = 120
  const [state, setState] = useState<BuildOperationState>({
    buildingMessageId: null,
    writtenMessageIds: new Set<string>(),
    builtMessageIds: new Set<string>(),
    buildResults: {},
    expandedBuildLogs: new Set<string>(),
    devServerRunning: new Set<string>(),
    exportingMessageIds: new Set<string>()
  })

  const devServerAbortControllersRef = useRef<Record<string, AbortController>>({})
  // 使用 ref 存储实时日志，减少状态更新频率
  const buildLogsRef = useRef<Record<string, string[]>>({})
  // 定时更新状态
  const updateIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({})

  /**
   * 更新状态的辅助函数
   */
  const updateState = useCallback((updater: (prev: BuildOperationState) => BuildOperationState) => {
    setState(updater)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(updateIntervalsRef.current).forEach(clearTimeout)
    }
  }, [])

  // 批量更新日志状态的辅助函数
  const flushLogsToState = useCallback((messageId: string, startTime: number) => {
    const logs = buildLogsRef.current[messageId]
    if (!logs || logs.length === 0) return

    const newLogContent = logs.join('\n')
    const newExecutionTime = (Date.now() - startTime) / 1000

    updateState((prev) => {
      const currentResult = prev.buildResults[messageId]
      
      // 如果日志内容和执行时间都没有实质变化，不更新状态
      if (currentResult && 
          currentResult.stdout === newLogContent &&
          Math.floor(currentResult.execution_time) === Math.floor(newExecutionTime)) {
        return prev
      }

      // 创建新的状态对象
      return {
        ...prev,
        buildResults: {
          ...prev.buildResults,
          [messageId]: {
            success: null,
            command: 'mvn -B clean install -DskipTests -Dstyle.color=never --no-transfer-progress',
            exit_code: null,
            stdout: newLogContent,
            stderr: '',
            execution_time: newExecutionTime,
            message: 'Maven 构建中...',
            phase: 'build'
          }
        }
      }
    })
  }, [updateState])

  /**
   * 切换构建日志展开状态
   */
  const toggleBuildLogs = useCallback((messageId: string, isOpen?: boolean) => {
    setState((prev) => {
      const next = new Set(prev.expandedBuildLogs)
      const currentlyOpen = next.has(messageId)
      const shouldOpen = typeof isOpen === 'boolean' ? isOpen : !currentlyOpen
      if (shouldOpen === currentlyOpen) {
        return prev
      }
      if (shouldOpen) {
        next.add(messageId)
      } else {
        next.delete(messageId)
      }
      return { ...prev, expandedBuildLogs: next }
    })
  }, [])

  /**
   * 处理写入 XML
   */
  const handleWriteXml = useCallback(async (xmlContent: string, messageId: string) => {
    callbacks?.onWriteStart?.(messageId)
    updateState((prev) => ({ ...prev, buildingMessageId: messageId }))

    try {
      const result = await chatApi.buildXml(xmlContent, { source: 'chat' })
      updateState((prev) => ({
        ...prev,
        buildingMessageId: null,
        writtenMessageIds: new Set(prev.writtenMessageIds).add(messageId)
      }))
      callbacks?.onWriteComplete?.(messageId)
    } catch (error) {
      console.error('写入失败:', error)
      updateState((prev) => ({ ...prev, buildingMessageId: null }))
      throw error
    }
  }, [callbacks, updateState])

  /**
   * 处理构建 XML
   */
  const handleBuildXml = useCallback(async (messageId: string) => {
    callbacks?.onBuildStart?.(messageId)
    updateState((prev) => ({
      ...prev,
      buildingMessageId: messageId,
      expandedBuildLogs: new Set(prev.expandedBuildLogs).add(messageId)
    }))

    const startTime = Date.now()
    // 初始化日志存储
    buildLogsRef.current[messageId] = []

    try {
      await chatApi.executeBuildCommandStream(
        {
          command: 'mvn -B clean install -DskipTests -Dstyle.color=never --no-transfer-progress',
          command_type: 'maven',
          timeout: 600
        },
        {
          onLog: (line: string) => {
            // 存储日志到 ref
            buildLogsRef.current[messageId].push(line)

            // 节流刷新：持续输出也能实时更新
            if (!updateIntervalsRef.current[messageId]) {
              updateIntervalsRef.current[messageId] = setTimeout(() => {
                flushLogsToState(messageId, startTime)
                delete updateIntervalsRef.current[messageId]
              }, LOG_FLUSH_INTERVAL)
            }
          },
          onComplete: (success: boolean, message: string) => {
            // 清除定时器并立即更新
            if (updateIntervalsRef.current[messageId]) {
              clearTimeout(updateIntervalsRef.current[messageId])
              delete updateIntervalsRef.current[messageId]
            }

            const executionTime = (Date.now() - startTime) / 1000
            const logs = buildLogsRef.current[messageId] || []

            updateState((prev) => {
              const newResults = {
                ...prev.buildResults,
                [messageId]: {
                  success,
                  command: 'mvn -B clean install -DskipTests -Dstyle.color=never --no-transfer-progress',
                  exit_code: success ? 0 : -1,
                  stdout: logs.join('\n'),
                  stderr: '',
                  execution_time: executionTime,
                  message,
                  phase: 'build' as const
                }
              }

              if (success) {
                callbacks?.onBuildComplete?.(messageId, newResults[messageId])
                return {
                  ...prev,
                  buildResults: newResults,
                  builtMessageIds: new Set(prev.builtMessageIds).add(messageId)
                }
              } else {
                callbacks?.onBuildError?.(messageId, message)
                return { ...prev, buildResults: newResults }
              }
            })

            // 清理 ref
            delete buildLogsRef.current[messageId]
          },
          onError: (error: string) => {
            // 清除定时器并立即更新
            if (updateIntervalsRef.current[messageId]) {
              clearTimeout(updateIntervalsRef.current[messageId])
              delete updateIntervalsRef.current[messageId]
            }

            const logs = buildLogsRef.current[messageId] || []
            updateState((prev) => {
              return {
                ...prev,
                buildResults: {
                  ...prev.buildResults,
                  [messageId]: {
                    success: false,
                    command: 'mvn -B clean install -DskipTests -Dstyle.color=never --no-transfer-progress',
                    exit_code: -1,
                    stdout: logs.join('\n'),
                    stderr: error,
                    execution_time: (Date.now() - startTime) / 1000,
                    message: `构建错误: ${error}`,
                    phase: 'build'
                  }
                }
              }
            })

            // 清理 ref
            delete buildLogsRef.current[messageId]
          }
        }
      )
    } catch (error) {
      // 清除定时器并立即更新
      if (updateIntervalsRef.current[messageId]) {
        clearTimeout(updateIntervalsRef.current[messageId])
        delete updateIntervalsRef.current[messageId]
      }

      const executionTime = (Date.now() - startTime) / 1000
      const logs = buildLogsRef.current[messageId] || []
      updateState((prev) => {
        return {
          ...prev,
          buildResults: {
            ...prev.buildResults,
            [messageId]: {
              success: false,
              command: 'mvn -B clean install -DskipTests -Dstyle.color=never --no-transfer-progress',
              exit_code: -1,
              stdout: logs.join('\n'),
              stderr: error instanceof Error ? error.message : String(error),
              execution_time: executionTime,
              message: `构建失败: ${error instanceof Error ? error.message : String(error)}`,
              phase: 'build'
            }
          }
        }
      })

      // 清理 ref
      delete buildLogsRef.current[messageId]
      throw error
    } finally {
      updateState((prev) => ({ ...prev, buildingMessageId: null }))
    }
  }, [callbacks, updateState])

  /**
   * 停止 Quarkus 开发服务器
   */
  const stopQuarkusDevServer = useCallback(async (messageId: string) => {
    try {
      const controller = devServerAbortControllersRef.current[messageId]
      if (controller) {
        controller.abort()
        delete devServerAbortControllersRef.current[messageId]
      }

      await chatApi.stopService(8080)

      updateState((prev) => {
        const next = new Set(prev.devServerRunning)
        next.delete(messageId)
        const current = prev.buildResults[messageId]
        return {
          ...prev,
          devServerRunning: next,
          buildResults: current ? {
            ...prev.buildResults,
            [messageId]: {
              ...current,
              success: true,
              message: '服务已停止',
              phase: 'build'
            }
          } : prev.buildResults
        }
      })

      callbacks?.onDevServerStop?.(messageId)
    } catch (error) {
      console.error('停止开发服务器失败:', error)
      updateState((prev) => {
        const next = new Set(prev.devServerRunning)
        next.delete(messageId)
        return { ...prev, devServerRunning: next }
      })
    }
  }, [callbacks, updateState])

  /**
   * 处理导出 Excel
   */
  const handleExportExcel = useCallback(async (messageId: string) => {
    const outputName = 'app.orm.xlsx'
    const exportResultKey = `${messageId}_export`

    callbacks?.onExportStart?.(messageId)
    updateState((prev) => ({
      ...prev,
      exportingMessageIds: new Set(prev.exportingMessageIds).add(messageId),
      buildResults: {
        ...prev.buildResults,
        [exportResultKey]: {
          success: null,
          command: '导出 Excel',
          exit_code: null,
          stdout: '',
          stderr: '',
          execution_time: 0,
          message: '正在导出...',
          phase: 'build'
        }
      }
    }))

    try {
      await chatApi.exportExcelStream(
        outputName,
        {
          onLog: (line: string) => {
            // 存储日志到 ref
            if (!buildLogsRef.current[exportResultKey]) {
              buildLogsRef.current[exportResultKey] = []
            }
            buildLogsRef.current[exportResultKey].push(line)

            // 节流刷新：持续输出也能实时更新
            if (!updateIntervalsRef.current[exportResultKey]) {
              updateIntervalsRef.current[exportResultKey] = setTimeout(() => {
              const logs = buildLogsRef.current[exportResultKey] || []
              const newLogContent = logs.join('\n')
              
              updateState((prev) => {
                const current = prev.buildResults[exportResultKey]
                
                // 如果日志内容没有变化，不更新状态
                if (current && current.stdout === newLogContent) {
                  return prev
                }
                
                // 创建新的状态对象
                return {
                  ...prev,
                  buildResults: {
                    ...prev.buildResults,
                    [exportResultKey]: {
                      ...current,
                      stdout: newLogContent
                    }
                  }
                }
              })
              delete updateIntervalsRef.current[exportResultKey]
              }, LOG_FLUSH_INTERVAL)
            }
          },
          onComplete: (success: boolean, message: string, outputName?: string) => {
            // 清除定时器并立即更新
            if (updateIntervalsRef.current[exportResultKey]) {
              clearTimeout(updateIntervalsRef.current[exportResultKey])
              delete updateIntervalsRef.current[exportResultKey]
            }

            updateState((prev) => {
              const current = prev.buildResults[exportResultKey]
              const nextExporting = new Set(prev.exportingMessageIds)
              nextExporting.delete(messageId)
              return {
                ...prev,
                exportingMessageIds: nextExporting,
                buildResults: {
                  ...prev.buildResults,
                  [exportResultKey]: {
                    ...current,
                    success,
                    message,
                    exit_code: success ? 0 : -1
                  }
                }
              }
            })

            // 清理 ref
            delete buildLogsRef.current[exportResultKey]

            if (success && outputName) {
              const downloadUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/build/export/excel/download?filename=${outputName}`
              const a = document.createElement('a')
              a.href = downloadUrl
              a.download = outputName
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)

              callbacks?.onExportComplete?.(messageId, {
                success: true,
                command: '导出 Excel',
                exit_code: 0,
                stdout: '',
                stderr: '',
                execution_time: 0,
                message,
                phase: 'build'
              })
            }
          },
          onError: (error: string) => {
            // 清除定时器并立即更新
            if (updateIntervalsRef.current[exportResultKey]) {
              clearTimeout(updateIntervalsRef.current[exportResultKey])
              delete updateIntervalsRef.current[exportResultKey]
            }

            updateState((prev) => {
              const current = prev.buildResults[exportResultKey]
              const nextExporting = new Set(prev.exportingMessageIds)
              nextExporting.delete(messageId)
              return {
                ...prev,
                exportingMessageIds: nextExporting,
                buildResults: {
                  ...prev.buildResults,
                  [exportResultKey]: {
                    ...current,
                    success: false,
                    message: error,
                    exit_code: -1
                  }
                }
              }
            })

            // 清理 ref
            delete buildLogsRef.current[exportResultKey]
          }
        }
      )
    } catch (error) {
      // 清除定时器并立即更新
      if (updateIntervalsRef.current[exportResultKey]) {
        clearTimeout(updateIntervalsRef.current[exportResultKey])
        delete updateIntervalsRef.current[exportResultKey]
      }

      updateState((prev) => {
        const current = prev.buildResults[exportResultKey]
        const nextExporting = new Set(prev.exportingMessageIds)
        nextExporting.delete(messageId)
        return {
          ...prev,
          exportingMessageIds: nextExporting,
          buildResults: {
            ...prev.buildResults,
            [exportResultKey]: {
              ...current,
              success: false,
              message: error instanceof Error ? error.message : String(error),
              exit_code: -1
            }
          }
        }
      })

      // 清理 ref
      delete buildLogsRef.current[exportResultKey]
    }
  }, [callbacks, updateState])

  /**
   * 启动 Quarkus 开发服务器
   */
  const startQuarkusDevServer = useCallback(async (messageId: string) => {
    callbacks?.onDevServerStart?.(messageId)
    updateState((prev) => ({
      ...prev,
      devServerRunning: new Set(prev.devServerRunning).add(messageId),
      buildResults: {
        ...prev.buildResults,
        [messageId]: {
          ...prev.buildResults[messageId],
          success: null,
          message: '清理端口中...',
          phase: 'dev'
        }
      }
    }))

    const devStartTime = Date.now()
    const controller = new AbortController()
    devServerAbortControllersRef.current[messageId] = controller

    try {
      const initialLogs = ['--- 清理 8080 端口 ---']
      try {
        const portKillResult = await chatApi.executeBuildCommand({
          command: 'ziro kill -f 8080',
          command_type: 'custom',
          timeout: 10
        })
        if (portKillResult.stdout) {
          initialLogs.push(portKillResult.stdout)
        }
      } catch (portError) {
        initialLogs.push(`端口清理异常: ${portError instanceof Error ? portError.message : String(portError)}`)
      }

      initialLogs.push('端口清理完成，准备启动 Quarkus...')

      // 初始化日志存储
      buildLogsRef.current[messageId] = initialLogs

      updateState((prev) => {
        const current = prev.buildResults[messageId]
        return {
          ...prev,
          buildResults: {
            ...prev.buildResults,
            [messageId]: {
              ...current,
              success: null,
              message: 'Quarkus 项目启动中...',
              phase: 'dev',
              stdout: initialLogs.join('\n')
            }
          }
        }
      })

      await chatApi.executeBuildCommandStream(
        {
          command: 'mvn -B -pl labor-tracking-app -am io.quarkus:quarkus-maven-plugin:dev -Dstyle.color=never --no-transfer-progress',
          command_type: 'maven',
          timeout: 3600
        },
        {
          onLog: (line: string) => {
            // 存储日志到 ref
            buildLogsRef.current[messageId].push(line)

            // 节流刷新：持续输出也能实时更新
            if (!updateIntervalsRef.current[messageId]) {
              updateIntervalsRef.current[messageId] = setTimeout(() => {
              const logs = buildLogsRef.current[messageId]
              if (logs) {
                const newLogContent = logs.join('\n')
                
                updateState((prev) => {
                  const current = prev.buildResults[messageId]
                  
                  // 如果日志内容没有变化，不更新状态
                  if (current && current.stdout === newLogContent) {
                    return prev
                  }
                  
                  // 创建新的状态对象
                  return {
                    ...prev,
                    buildResults: {
                      ...prev.buildResults,
                      [messageId]: {
                        ...current,
                        stdout: newLogContent
                      }
                    }
                  }
                })
              }
              delete updateIntervalsRef.current[messageId]
              }, LOG_FLUSH_INTERVAL)
            }
          },
          onComplete: (success: boolean, message: string) => {
            // 清除定时器
            if (updateIntervalsRef.current[messageId]) {
              clearTimeout(updateIntervalsRef.current[messageId])
              delete updateIntervalsRef.current[messageId]
            }
            delete devServerAbortControllersRef.current[messageId]

            updateState((prev) => {
              const next = new Set(prev.devServerRunning)
              next.delete(messageId)
              return { ...prev, devServerRunning: next }
            })

            // 清理 ref
            delete buildLogsRef.current[messageId]
          },
          onError: (error: string) => {
            // 清除定时器
            if (updateIntervalsRef.current[messageId]) {
              clearTimeout(updateIntervalsRef.current[messageId])
              delete updateIntervalsRef.current[messageId]
            }
            delete devServerAbortControllersRef.current[messageId]

            updateState((prev) => {
              const next = new Set(prev.devServerRunning)
              next.delete(messageId)
              return { ...prev, devServerRunning: next }
            })

            // 清理 ref
            delete buildLogsRef.current[messageId]
          }
        },
        controller.signal
      )
    } catch (error) {
      // 清除定时器
      if (updateIntervalsRef.current[messageId]) {
        clearTimeout(updateIntervalsRef.current[messageId])
        delete updateIntervalsRef.current[messageId]
      }
      delete devServerAbortControllersRef.current[messageId]
      updateState((prev) => {
        const next = new Set(prev.devServerRunning)
        next.delete(messageId)
        return { ...prev, devServerRunning: next }
      })
      // 清理 ref
      delete buildLogsRef.current[messageId]
    }
  }, [callbacks, updateState])

  return {
    state,
    handleWriteXml,
    handleBuildXml,
    stopQuarkusDevServer,
    startQuarkusDevServer,
    handleExportExcel,
    toggleBuildLogs
  }
}
