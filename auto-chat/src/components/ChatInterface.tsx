import { useState, useRef, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import type { Message, Attachment } from '@/types/chat'
import type { ResizeDirection } from '@/types/ui'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useInputResize } from '@/hooks/useInputResize'
import { useBuildOperation } from '@/hooks/useBuildOperation'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { CodeBlock } from './CodeBlock'
import styles from './ChatInterface.module.css'

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string, attachments?: Attachment[]) => void | Promise<void>
  onBuild?: (xmlContent: string) => void | Promise<void>
  placeholder?: string
  disabled?: boolean
  initialInput?: string
}

/**
 * 聊天界面组件（重构版）
 * 使用子组件和自定义 Hooks 的协调组件
 */
export function ChatInterface({
  messages,
  onSendMessage,
  onBuild,
  placeholder = '输入消息...',
  disabled = false,
  initialInput
}: ChatInterfaceProps) {
  // 输入状态
  const [input, setInput] = useState(initialInput || '')

  // 思考内容展开状态
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())

  // 文件上传 Hook
  const {
    attachments,
    isDragging,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop
  } = useFileUpload()

  // 输入框调整 Hook
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const {
    isResizing,
    textareaSize,
    handleResizeStart
  } = useInputResize(inputAreaRef)

  // 构建操作 Hook
  const {
    state: buildState,
    handleWriteXml,
    handleBuildXml,
    stopQuarkusDevServer,
    startQuarkusDevServer,
    handleExportExcel,
    toggleBuildLogs
  } = useBuildOperation()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 切换思考内容展开状态
  const toggleThinking = useCallback((messageId: string) => {
    setExpandedThinking((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }, [])

  // 渲染消息内容（支持代码块）
  const renderContent = useCallback(
    (content: string, messageId?: string, isThinkingContent?: boolean) => {
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
      const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = []
      let lastIndex = 0
      let match

      while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: content.slice(lastIndex, match.index)
          })
        }
        parts.push({
          type: 'code',
          lang: match[1] || '',
          content: match[2]
        })
        lastIndex = match.index + match[0].length
      }

      if (lastIndex < content.length) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex)
        })
      }

      if (parts.length === 0) {
        return content
      }

      return parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              content={part.content}
              lang={part.lang}
              messageId={messageId}
              isThinkingContent={isThinkingContent}
              buildState={buildState}
              onBuild={onBuild}
              onWriteXml={onBuild ? handleWriteXml : undefined}
              onBuildXml={handleBuildXml}
              onStartDev={startQuarkusDevServer}
              onStopDev={stopQuarkusDevServer}
              onExportExcel={handleExportExcel}
            />
          )
        }
        return <span key={index}>{part.content}</span>
      })
    },
    [buildState, onBuild, handleWriteXml, handleBuildXml, startQuarkusDevServer, stopQuarkusDevServer, handleExportExcel]
  )

  // 处理文件输入变化
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFileSelect])

  // 处理发送消息
  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if ((!trimmed && attachments.length === 0) || disabled) return

    setInput('')
    clearAttachments()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    await onSendMessage(trimmed, attachments)
  }, [input, attachments, disabled, onSendMessage, clearAttachments])

  // 处理初始输入值（用于 Figma 数据导入）
  useEffect(() => {
    if (initialInput !== undefined && initialInput !== input) {
      setInput(initialInput)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        const newHeight = Math.min(textareaRef.current.scrollHeight, 200)
        textareaRef.current.style.height = `${newHeight}px`
      }
    }
  }, [initialInput])

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        <MessageList
          messages={messages}
          buildState={buildState}
          expandedThinking={expandedThinking}
          renderContent={renderContent}
          onToggleThinking={toggleThinking}
          onToggleBuildLogs={toggleBuildLogs}
          onWriteXml={handleWriteXml}
          onBuildXml={handleBuildXml}
          onStartDev={startQuarkusDevServer}
          onStopDev={stopQuarkusDevServer}
          onExportExcel={handleExportExcel}
        />
      </div>

      <InputArea
        input={input}
        setInput={setInput}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onClearAttachments={clearAttachments}
        onFileInputChange={handleFileInputChange}
        onFileSelect={handleFileSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSend={handleSend}
        disabled={disabled}
        placeholder={placeholder}
        isDragging={isDragging}
        textareaSize={textareaSize}
        onResizeStart={handleResizeStart}
        inputAreaRef={inputAreaRef}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
      />
    </div>
  )
}
