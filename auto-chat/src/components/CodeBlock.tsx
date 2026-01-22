import { memo, useCallback, useMemo } from 'react'
import { Loader2, Square, Cpu, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { chatApi } from '@/services/chatApi'
import type { BuildOperationState } from '@/types/build'
import styles from './ChatInterface.module.css'

export interface CodeBlockProps {
  content: string
  lang?: string
  messageId?: string
  isThinkingContent?: boolean
  buildState: BuildOperationState
  onBuild?: (xmlContent: string) => void | Promise<void>
  onWriteXml?: (xmlContent: string, messageId: string) => void
  onBuildXml?: (messageId: string) => void
  onStartDev?: (messageId: string) => void
  onStopDev?: (messageId: string) => void
  onExportExcel?: (messageId: string) => void
}

/**
 * 代码块组件
 * 显示代码块，支持构建、写入、启动服务、导出等操作
 */
export const CodeBlock = memo(({
  content,
  lang = '',
  messageId,
  isThinkingContent = false,
  buildState,
  onBuild,
  onWriteXml,
  onBuildXml,
  onStartDev,
  onStopDev,
  onExportExcel
}: CodeBlockProps) => {
  // 使用 useMemo 缓存 XML 类型检测
  const isXmlCode = useMemo(
    () => lang === 'xml' || (!lang && content.includes('<')),
    [lang, content]
  )

  const xmlType = useMemo(
    () => isXmlCode && messageId && !isThinkingContent ? chatApi.detectXmlType(content) : null,
    [isXmlCode, messageId, isThinkingContent, content]
  )

  const canBuild = useMemo(
    () => isXmlCode && xmlType && onBuild && messageId && !isThinkingContent,
    [isXmlCode, xmlType, onBuild, messageId, isThinkingContent]
  )

  const isWritten = useMemo(
    () => messageId && buildState.writtenMessageIds.has(messageId),
    [buildState.writtenMessageIds, messageId]
  )

  const isBuilt = useMemo(
    () => messageId && buildState.builtMessageIds.has(messageId),
    [buildState.builtMessageIds, messageId]
  )

  const isBuilding = useMemo(
    () => buildState.buildingMessageId === messageId,
    [buildState.buildingMessageId, messageId]
  )

  const isStartingDev = useMemo(
    () => messageId && buildState.devServerRunning.has(messageId),
    [buildState.devServerRunning, messageId]
  )

  const isExporting = useMemo(
    () => messageId && buildState.exportingMessageIds.has(messageId),
    [buildState.exportingMessageIds, messageId]
  )

  const canStartDev = useMemo(
    () => messageId && isWritten && isBuilt && !isBuilding && !buildState.devServerRunning.has(messageId),
    [messageId, isWritten, isBuilt, isBuilding, buildState.devServerRunning]
  )

  const buildResult = useMemo(
    () => messageId ? buildState.buildResults[messageId] : null,
    [buildState.buildResults, messageId]
  )

  // 类型显示名称映射
  const typeLabels: Record<string, string> = useMemo(() => ({
    'orm': 'ORM',
    'config': '配置',
    'api': 'API'
  }), [])

  const handleWriteClick = useCallback(() => {
    if (onWriteXml && messageId) {
      onWriteXml(content, messageId)
    }
  }, [content, messageId, onWriteXml])

  const handleBuildClick = useCallback(() => {
    if (onBuildXml && messageId) {
      onBuildXml(messageId)
    }
  }, [messageId, onBuildXml])

  const handleStartDevClick = useCallback(() => {
    if (onStartDev && messageId) {
      onStartDev(messageId)
    }
  }, [messageId, onStartDev])

  const handleStopDevClick = useCallback(() => {
    if (onStopDev && messageId) {
      onStopDev(messageId)
    }
  }, [messageId, onStopDev])

  const handleExportClick = useCallback(() => {
    if (onExportExcel && messageId) {
      onExportExcel(messageId)
    }
  }, [messageId, onExportExcel])

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang || (isXmlCode ? 'xml' : '')}</span>
      </div>
      <pre><code>{content}</code></pre>

      {canBuild && (
        <div className={styles.codeActions}>
          {/* 写入按钮 */}
          {!isWritten && (
            <button
              onClick={handleWriteClick}
              disabled={isBuilding}
              className={styles.writeButton}
            >
              {isBuilding ? (
                <>
                  <Loader2 size={14} className={styles.spin} />
                  <span>写入中...</span>
                </>
              ) : (
                <>
                  <Cpu size={14} />
                  <span>写入 {typeLabels[xmlType] || xmlType}</span>
                </>
              )}
            </button>
          )}

          {/* 构建按钮 */}
          {isWritten && !isBuilt && (
            <button
              onClick={handleBuildClick}
              disabled={isBuilding}
              className={styles.buildButton}
            >
              {isBuilding ? (
                <>
                  <Loader2 size={14} className={styles.spin} />
                  <span>构建中...</span>
                </>
              ) : (
                <>
                  <Cpu size={14} />
                  <span>构建</span>
                </>
              )}
            </button>
          )}

          {/* 启动服务按钮 */}
          {canStartDev && (
            <button
              onClick={handleStartDevClick}
              disabled={isStartingDev}
              className={styles.buildButton}
            >
              {isStartingDev ? (
                <>
                  <Loader2 size={14} className={styles.spin} />
                  <span>启动中...</span>
                </>
              ) : (
                <>
                  <Cpu size={14} />
                  <span>启动服务</span>
                </>
              )}
            </button>
          )}

          {/* 停止服务按钮 */}
          {buildState.devServerRunning.has(messageId!) && (
            <button
              onClick={handleStopDevClick}
              className={styles.stopButton}
            >
              <Square size={14} fill="currentColor" />
              <span>停止服务</span>
            </button>
          )}

          {/* 导出 Excel 按钮 */}
          {isBuilt && !isBuilding && (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              className={styles.exportButton}
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className={styles.spin} />
                  <span>导出中...</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>导出 Excel</span>
                </>
              )}
            </button>
          )}

          {/* 服务启动中状态 */}
          {isStartingDev && !buildState.devServerRunning.has(messageId!) && buildResult?.phase === 'dev' && (
            <button
              disabled
              className={clsx(styles.buildButton, styles.builtButton)}
            >
              <Loader2 size={14} className={styles.spin} />
              <span>启动中...</span>
            </button>
          )}

          {/* 已构建但无法启动服务的状态 */}
          {isBuilt && !canStartDev && !isStartingDev && !buildState.devServerRunning.has(messageId!) && (
            <button
              disabled
              className={clsx(styles.buildButton, styles.builtButton)}
            >
              <Cpu size={14} />
              <span>已构建</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'
