import { memo, useMemo } from 'react'
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
 * 展开时显示简化版，避免冗长内容
 */
export const ThinkingBlock = memo(({ message, isExpanded, onToggle, renderContent }: ThinkingBlockProps) => {
  if (!message.thinkingContent) return null

  // 简化思考内容，保留完整结构但压缩每个步骤
  const displayContent = useMemo(() => {
    const content = message.thinkingContent

    // 如果内容很短（< 500字符），直接显示
    if (content.length < 500) {
      return content
    }

    // 提取步骤（匹配 "1. **标题**" 或 "**中文标题**" 格式）
    const stepPattern = /\n(?=(\d+\. \*\*[^*]+\*\*)|(\*\*[\u4e00-\u9fa5]+[^*]*\*\*))/g
    const steps = content.split(stepPattern).filter(s => s && s.trim && s.trim().length > 15)

    if (steps.length === 0) {
      // 如果无法解析步骤，返回前300字符
      return content.substring(0, 300) + '\n\n_...(内容过长，已省略部分细节)_'
    }

    // 处理每个步骤，保留更多细节
    const processed = steps.map((step, index) => {
      const lines = step.trim().split('\n').filter(l => l.trim())
      if (lines.length === 0) return null

      // 提取标题
      const titleLine = lines[0].replace(/\*\*/g, '').replace(/^\d+\.\s*/, '').trim()

      // 保留内容部分（最多保留前3行有意义的子项）
      const subItems = lines.slice(1)
        .filter(l => l.trim() && l.length > 5)
        .filter(l => !l.match(/^\d+\.|\*\*/)) // 过滤掉子标题
        .slice(0, 3)
        .map(line => {
          // 去除 markdown 格式，保留关键信息
          const clean = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-*+]\s*/, '').trim()
          // 限制每行长度
          return clean.length > 80 ? clean.substring(0, 80) + '...' : clean
        })

      // 构建步骤文本
      let stepText = `${index + 1}. **${titleLine}**\n`

      if (subItems.length > 0) {
        stepText += subItems.map(item => `   - ${item}`).join('\n')
      }

      return stepText
    }).filter(Boolean)

    const result = processed.join('\n\n')

    // 如果步骤很多，添加提示
    if (steps.length > 10) {
      return result + `\n\n\n_...(还有 ${steps.length - 10} 个步骤已省略，关键信息已显示)_`
    }

    return result
  }, [message.thinkingContent])

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
