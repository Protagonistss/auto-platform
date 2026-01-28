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
  onToggleBuildLogs: (messageId: string, isOpen?: boolean) => void
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

  const handleToggleBuildLogs = useCallback((targetMessageId: string, isOpen: boolean) => {
    onToggleBuildLogs(targetMessageId, isOpen)
  }, [onToggleBuildLogs])

  // 直接获取构建结果
  const buildResult = buildState.buildResults[message.id]
  const exportResult = buildState.buildResults[`${message.id}_export`]

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
                onToggle={(isOpen) => handleToggleBuildLogs(message.id, isOpen)}
                autoScroll={shouldAutoScrollBuild}
              />
            )}

            {/* 导出 Excel 结果 */}
            {exportResult && (
              <BuildLogs
                messageId={`${message.id}_export`}
                buildResult={exportResult}
                isExpanded={isExportExpanded}
                onToggle={(isOpen) => handleToggleBuildLogs(`${message.id}_export`, isOpen)}
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
  // 自定义比较函数：使用早期返回，提高性能
  const messageId = prevProps.message.id

  // 1. 基础属性检查
  if (prevProps.message.id !== nextProps.message.id) return false
  if (prevProps.message.content !== nextProps.message.content) return false
  if (prevProps.message.thinkingContent !== nextProps.message.thinkingContent) return false
  if (prevProps.message.loading !== nextProps.message.loading) return false
  if (prevProps.message.statusText !== nextProps.message.statusText) return false
  if (prevProps.thinkingExpanded !== nextProps.thinkingExpanded) return false
  if (prevProps.renderContent !== nextProps.renderContent) return false

  // 2. 构建状态检查
  if (prevProps.buildState.writtenMessageIds.has(messageId) !== nextProps.buildState.writtenMessageIds.has(messageId)) return false
  if (prevProps.buildState.builtMessageIds.has(messageId) !== nextProps.buildState.builtMessageIds.has(messageId)) return false
  if (prevProps.buildState.buildingMessageId === messageId !== (nextProps.buildState.buildingMessageId === messageId)) return false

  // 3. 展开状态检查
  if (prevProps.buildState.expandedBuildLogs.has(messageId) !== nextProps.buildState.expandedBuildLogs.has(messageId)) return false
  if (prevProps.buildState.expandedBuildLogs.has(`${messageId}_export`) !== nextProps.buildState.expandedBuildLogs.has(`${messageId}_export`)) return false

  // 4. 运行状态检查
  if (prevProps.buildState.devServerRunning.has(messageId) !== nextProps.buildState.devServerRunning.has(messageId)) return false
  if (prevProps.buildState.exportingMessageIds.has(messageId) !== nextProps.buildState.exportingMessageIds.has(messageId)) return false

  // 5. 构建结果检查（通过引用比较）
  const prevResult = prevProps.buildState.buildResults[messageId]
  const nextResult = nextProps.buildState.buildResults[messageId]
  if (prevResult !== nextResult) return false

  const prevExportResult = prevProps.buildState.buildResults[`${messageId}_export`]
  const nextExportResult = nextProps.buildState.buildResults[`${messageId}_export`]
  if (prevExportResult !== nextExportResult) return false

  // 所有检查都通过，不需要重渲染
  return true
})

MessageItem.displayName = 'MessageItem'
