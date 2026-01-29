import { memo } from 'react'
import { Brain, ChevronRight, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { Message } from '@/types/chat'
import styles from './ChatInterface.module.css'

export interface ThinkingBlockProps {
  message: Message
  isExpanded: boolean
  onToggle: () => void
  renderContent: (content: string, messageId?: string, isThinkingContent?: boolean) => React.ReactNode
}

/**
 * 思考块组件
 * 显示 AI 的思考过程，可展开/收起
 */
export const ThinkingBlock = memo(({ message, isExpanded, onToggle, renderContent }: ThinkingBlockProps) => {
  if (!message.thinkingContent) return null
  const displayContent = message.thinkingContent

  return (
    <div className={styles.thinkingSection}>
      <button
        className={styles.thinkingToggle}
        onClick={onToggle}
      >
        <span className={styles.thinkingIcon}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Brain size={14} />
        <span className={styles.thinkingLabel}>思考过程</span>
      </button>
      {isExpanded && (
        <div className={styles.thinkingContent}>
          {renderContent(displayContent, undefined, true)}
        </div>
      )}
    </div>
  )
})

ThinkingBlock.displayName = 'ThinkingBlock'
