import { useCallback } from 'react'
import { chatApi } from '@/services/chatApi'

/**
 * 构建相关 API Hook
 * 封装构建相关的 API 调用
 */
export function useBuild() {
  /**
   * 检测 XML 类型
   */
  const detectXmlType = useCallback((xmlContent: string): string | null => {
    return chatApi.detectXmlType(xmlContent)
  }, [])

  /**
   * 写入/构建 XML
   */
  const buildXml = useCallback(
    async (
      xmlContent: string,
      options: {
        xmlType?: string
        source?: 'ai' | 'chat' | 'manual'
        taskId?: string
      } = {}
    ) => {
      return chatApi.buildXml(xmlContent, options)
    },
    []
  )

  /**
   * 执行构建命令
   */
  const executeBuildCommand = useCallback(
    async (request: {
      command: string
      cwd?: string
      timeout?: number
      command_type?: string
    }) => {
      return chatApi.executeBuildCommand(request)
    },
    []
  )

  /**
   * 流式执行构建命令
   */
  const executeBuildCommandStream = useCallback(
    async (
      request: {
        command: string
        cwd?: string
        timeout?: number
        command_type?: string
      },
      callbacks: {
        onLog: (line: string) => void
        onComplete: (success: boolean, message: string) => void
        onError: (error: string) => void
      },
      signal?: AbortSignal
    ) => {
      return chatApi.executeBuildCommandStream(request, callbacks, signal)
    },
    []
  )

  /**
   * 停止服务
   */
  const stopService = useCallback(async (port: number = 8080) => {
    return chatApi.stopService(port)
  }, [])

  /**
   * 导出 Excel
   */
  const exportExcel = useCallback(
    async (outputName: string = 'app.orm.xlsx') => {
      return chatApi.exportExcel(outputName)
    },
    []
  )

  /**
   * 流式导出 Excel
   */
  const exportExcelStream = useCallback(
    async (
      outputName: string,
      callbacks: {
        onLog: (line: string) => void
        onComplete: (success: boolean, message: string, outputName?: string) => void
        onError: (error: string) => void
      },
      signal?: AbortSignal
    ) => {
      return chatApi.exportExcelStream(outputName, callbacks, signal)
    },
    []
  )

  return {
    detectXmlType,
    buildXml,
    executeBuildCommand,
    executeBuildCommandStream,
    stopService,
    exportExcel,
    exportExcelStream
  }
}
