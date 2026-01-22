import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Square, Brain, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { ChatInterface } from './ChatInterface'
import type { Message, Attachment } from '@/types/chat'
import { useChat } from '@/hooks/useChat'
import { useConversation } from '@/hooks/useConversation'
import { chatApi } from '@/services/chatApi'
import styles from './ChatContainer.module.css'

interface ChatContainerProps {
  conversationId?: string
  onConversationCreated?: (id: string) => void
}

/**
 * 聊天容器组件（重构版）
 * 使用自定义 Hooks 管理状态和 API 调用
 */
export function ChatContainer({
  conversationId: propConversationId,
  onConversationCreated
}: ChatContainerProps) {
  // 从 URL 获取 token 参数
  const figmaToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('token')
  }, [])

  // 会话管理 Hook
  const {
    conversationId,
    createConversation,
    setCurrentConversationId,
    resetConversation
  } = useConversation()

  // 聊天消息 Hook
  const {
    messages,
    isLoading,
    error,
    abortController,
    sendMessage,
    cancelRequest,
    clearMessages,
    clearError
  } = useChat(conversationId)

  const [initialInput, setInitialInput] = useState<string | undefined>(undefined)
  const [isInitializing, setIsInitializing] = useState(true)
  const [enableThinking, setEnableThinking] = useState(false)

  // 防止重复加载 Figma 数据
  const figmaDataLoadedRef = useRef(false)
  const isInitializedRef = useRef(false)

  // 使用 ref 存储回调，避免作为依赖项
  const onConversationCreatedRef = useRef(onConversationCreated)
  onConversationCreatedRef.current = onConversationCreated

  // 初始化会话
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const initConversation = async () => {
      try {
        setIsInitializing(true)

        // 创建新会话
        const result = await createConversation('新对话')
        onConversationCreatedRef.current?.(result.conversation_id)

        // 如果有 figmaToken，获取 Figma 数据并设置到输入框
        if (figmaToken && !figmaDataLoadedRef.current) {
          figmaDataLoadedRef.current = true
          try {
            const figmaData = await chatApi.getFigmaPayload(figmaToken)
            setInitialInput(`\`\`\`json\n${JSON.stringify(figmaData.data, null, 2)}\n\`\`\`\n`)
          } catch (err) {
            // 静默处理 Figma 数据加载错误
            console.error('加载 Figma 数据失败:', err)
          }
        }
      } catch (err) {
        // 错误已经在 useConversation 中处理
        console.error('初始化失败:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    initConversation()
  }, [figmaToken, createConversation])

  // 处理消息发送
  const handleSendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      await sendMessage(content, attachments, enableThinking)
    },
    [sendMessage, enableThinking]
  )

  // 处理取消请求
  const handleCancel = useCallback(() => {
    cancelRequest()
  }, [cancelRequest])

  // 处理重置会话
  const handleReset = useCallback(async () => {
    clearMessages()
    setIsInitializing(true)

    try {
      const result = await resetConversation()
      onConversationCreatedRef.current?.(result.conversation_id)
    } catch (err) {
      console.error('重置会话失败:', err)
    } finally {
      setIsInitializing(false)
    }
  }, [clearMessages, resetConversation])

  // 处理构建
  const handleBuild = useCallback(async (xmlContent: string) => {
    try {
      const result = await chatApi.buildXml(xmlContent, { source: 'chat' })
      return result
    } catch (err) {
      throw err
    }
  }, [])


  if (isInitializing) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.spinner} size={40} />
        <p>初始化对话...</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.errorBanner}>
          <div className={styles.errorContent}>
            <span>{error}</span>
            <button onClick={clearError} className={styles.closeButton}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={handleReset} className={styles.resetButton} disabled={isLoading}>
            <Plus size={16} />
            <span>新对话</span>
          </button>
        </div>

        <div className={styles.headerRight}>
          <label className={clsx(styles.thinkingToggle, enableThinking && styles.active)}>
            <input
              type="checkbox"
              checked={enableThinking}
              onChange={(e) => setEnableThinking(e.target.checked)}
              disabled={isLoading}
            />
            <Brain size={16} />
            <span>思考模式</span>
          </label>

          {isLoading && abortController && (
            <button onClick={handleCancel} className={styles.cancelButton}>
              <Square size={14} fill="currentColor" />
              <span>停止生成</span>
            </button>
          )}
        </div>
      </div>

      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        onBuild={handleBuild}
        placeholder="输入消息..."
        disabled={isLoading}
        initialInput={initialInput}
      />
    </div>
  )
}
