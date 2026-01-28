import { memo, useCallback, useMemo } from 'react'
import { User, Bot, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Message } from '@/types/chat'
import type { BuildOperationState } from '@/types/build'
import { ThinkingBlock } from './ThinkingBlock'
import { AttachmentPreview } from './AttachmentPreview'
import { BuildLogs } from './BuildLogs'
import styles from './ChatInterface.module.css'

export interface MessageItemProps {
  message: Message
  buildState: BuildOperationState
  thinkingExpanded: boolean
  onToggleThinking: (messageId: string) => void
  onToggleBuildLogs: (messageId: string) => void
  renderContent: (content: string, messageId?: string, isThinkingContent?: boolean) => React.ReactNode
  onWriteXml?: (xmlContent: string, messageId: string) => void
  onBuildXml?: (messageId: string) => void
  onStartDev?: (messageId: string) => void
  onStopDev?: (messageId: string) => void
  onExportExcel?: (messageId: string) => void
}

/**
 * 单条消息组件
 * 显示一条消息的内容、附件、思考过程和构建结果
 * 使用自定义比较函数优化重渲染
 */
export const MessageItem = memo(({
  message,
  buildState,
  thinkingExpanded,
  onToggleThinking,
  onToggleBuildLogs,
  renderContent,
  onWriteXml,
  onBuildXml,
  onStartDev,
  onStopDev,
  onExportExcel
}: MessageItemProps) => {
  const handleToggleThinking = useCallback(() => {
    onToggleThinking(message.id)
  }, [message.id, onToggleThinking])

  const handleToggleBuildLogs = useCallback((isOpen: boolean) => {
    if (isOpen) {
      onToggleBuildLogs(message.id)
    } else {
      onToggleBuildLogs(message.id)
    }
  }, [message.id, onToggleBuildLogs])

  // 使用 useMemo 缓存构建结果，避免每次渲染都访问
  const buildResult = useMemo(
    () => buildState.buildResults[message.id],
    [buildState.buildResults, message.id]
  )

  const exportResult = useMemo(
    () => buildState.buildResults[`${message.id}_export`],
    [buildState.buildResults, message.id]
  )

  const isBuildExpanded = useMemo(
    () => buildState.expandedBuildLogs.has(message.id) || buildState.devServerRunning.has(message.id),
    [buildState.expandedBuildLogs, buildState.devServerRunning, message.id]
  )

  const isExportExpanded = useMemo(
    () => buildState.expandedBuildLogs.has(`${message.id}_export`) || buildState.exportingMessageIds.has(message.id),
    [buildState.expandedBuildLogs, buildState.exportingMessageIds, message.id]
  )

  const shouldAutoScrollBuild = useMemo(
    () => buildState.buildingMessageId === message.id || buildState.devServerRunning.has(message.id),
    [buildState.buildingMessageId, buildState.devServerRunning, message.id]
  )

  const shouldAutoScrollExport = useMemo(
    () => buildState.exportingMessageIds.has(message.id),
    [buildState.exportingMessageIds, message.id]
  )

  const formattedTime = useMemo(
    () => new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.timestamp]
  )

  return (
    <div
      key={message.id}
      className={clsx(styles.message, styles[message.role])}
    >
      <div className={styles.messageAvatar}>
        {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className={styles.messageContent}>
        {/* 附件列表 */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={styles.attachments}>
            {message.attachments.map((attachment) => (
              <AttachmentPreview key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {/* 加载状态 */}
        {message.loading ? (
          <div className={styles.messageBubble}>
            <div className={styles.loadingContainer}>
              <Loader2 className={styles.spin} size={18} />
              <span className={styles.loadingText}>{message.statusText || '处理中...'}</span>
            </div>
          </div>
        ) : (
          <>
            {/* 思考过程 */}
            <ThinkingBlock
              message={message}
              isExpanded={thinkingExpanded}
              onToggle={handleToggleThinking}
              renderContent={renderContent}
            />

            {/* 回答内容 */}
            {message.content && (
              <div className={styles.answerSection}>
                <div className={styles.messageBubble}>
                  {renderContent(message.content, message.role === 'assistant' ? message.id : undefined, false)}
                </div>
              </div>
            )}

            {/* 构建结果 */}
            {buildResult && (
              <BuildLogs
                messageId={message.id}
                buildResult={buildResult}
                isExpanded={isBuildExpanded}
                onToggle={handleToggleBuildLogs}
                autoScroll={shouldAutoScrollBuild}
              />
            )}

            {/* 导出 Excel 结果 */}
            {exportResult && (
              <BuildLogs
                messageId={`${message.id}_export`}
                buildResult={exportResult}
                isExpanded={isExportExpanded}
                onToggle={handleToggleBuildLogs}
                autoScroll={shouldAutoScrollExport}
              />
            )}
          </>
        )}

        {/* 时间戳 */}
        <div className={styles.messageTime}>
          {formattedTime}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键 props 变化时才重渲染
  const prevResult = prevProps.buildState.buildResults[prevProps.message.id]
  const nextResult = nextProps.buildState.buildResults[nextProps.message.id]
  const messageId = prevProps.message.id

  // 检查写入和构建状态是否变化
  const prevWritten = prevProps.buildState.writtenMessageIds.has(messageId)
  const nextWritten = nextProps.buildState.writtenMessageIds.has(messageId)
  const prevBuilt = prevProps.buildState.builtMessageIds.has(messageId)
  const nextBuilt = nextProps.buildState.builtMessageIds.has(messageId)

  // 如果 renderContent 变化，必须重新渲染
  if (prevProps.renderContent !== nextProps.renderContent) {
    return false
  }

  // 构建日志内容需要实时更新，所以不比较stdout
  // 只比较关键状态变化
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.loading === nextProps.message.loading &&
    prevProps.thinkingExpanded === nextProps.thinkingExpanded &&
    prevResult?.success === nextResult?.success &&
    prevResult?.phase === nextResult?.phase &&
    prevWritten === nextWritten &&
    prevBuilt === nextBuilt
  )
})

MessageItem.displayName = 'MessageItem'
