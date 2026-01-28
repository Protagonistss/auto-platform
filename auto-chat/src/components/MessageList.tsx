import { memo, useEffect, useRef } from 'react'
import { Bot } from 'lucide-react'
import type { Message } from '@/types/chat'
import type { BuildOperationState } from '@/types/build'
import { MessageItem } from './MessageItem'
import styles from './ChatInterface.module.css'

export interface MessageListProps {
  messages: Message[]
  buildState: BuildOperationState
  expandedThinking: Set<string>
  renderContent: (content: string, messageId?: string, isThinkingContent?: boolean) => React.ReactNode
  onToggleThinking: (messageId: string) => void
  onToggleBuildLogs: (messageId: string, isOpen?: boolean) => void
  onWriteXml?: (xmlContent: string, messageId: string) => void
  onBuildXml?: (messageId: string) => void
  onStartDev?: (messageId: string) => void
  onStopDev?: (messageId: string) => void
  onExportExcel?: (messageId: string) => void
}

/**
 * 消息列表组件
 * 显示所有消息，支持自动滚动
 */
export const MessageList = memo(({
  messages,
  buildState,
  expandedThinking,
  renderContent,
  onToggleThinking,
  onToggleBuildLogs,
  onWriteXml,
  onBuildXml,
  onStartDev,
  onStopDev,
  onExportExcel
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className={styles.messagesList}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Bot size={48} strokeWidth={1.5} />
          </div>
          <h3>欢迎使用 AI 助手</h3>
          <p>有什么我可以帮您的吗？</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.messagesList}>
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          buildState={buildState}
          thinkingExpanded={expandedThinking.has(message.id)}
          onToggleThinking={onToggleThinking}
          onToggleBuildLogs={onToggleBuildLogs}
          renderContent={renderContent}
          onWriteXml={onWriteXml}
          onBuildXml={onBuildXml}
          onStartDev={onStartDev}
          onStopDev={onStopDev}
          onExportExcel={onExportExcel}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
})

MessageList.displayName = 'MessageList'
