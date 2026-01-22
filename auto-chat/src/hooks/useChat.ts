import { useState, useCallback, useRef } from 'react'
import { chatApi } from '@/services/chatApi'
import type { Message, Attachment, SSECallbacks } from '@/types/chat'

/**
 * 聊天消息操作 Hook
 * 处理消息发送、SSE 流式接收
 */
export function useChat(conversationId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // 使用 ref 存储当前消息 ID，避免闭包问题
  const currentMessageIdRef = useRef<string | null>(null)

  /**
   * 发送消息（SSE 流式）
   */
  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: Attachment[],
      enableThinking: boolean = false
    ) => {
      if (!conversationId) {
        setError('会话未初始化')
        return
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        attachments
      }
      setMessages((prev) => [...prev, userMessage])

      const tempAssistantId = `assistant-temp-${Date.now()}`
      currentMessageIdRef.current = tempAssistantId
      const tempAssistantMessage: Message = {
        id: tempAssistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        loading: true,
        statusText: '连接中...'
      }
      setMessages((prev) => [...prev, tempAssistantMessage])

      try {
        setIsLoading(true)
        setError(null)

        let fileIds: string[] = []
        if (attachments && attachments.length > 0) {
          for (const attachment of attachments) {
            if (attachment.file) {
              const result = await chatApi.uploadFile(conversationId, attachment.file)
              fileIds.push(result.file_id)
            }
          }
        }

        const controller = new AbortController()
        setAbortController(controller)

        const callbacks: SSECallbacks = {
          onStart: (data) => {
            currentMessageIdRef.current = data.message_id
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, id: data.message_id, statusText: 'AI 思考中...' }
                  : msg
              )
            )
          },
          onChunk: (chunk, thinking) => {
            const currentId = currentMessageIdRef.current
            if (!currentId) return
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === currentId
                  ? thinking
                    ? {
                        ...msg,
                        thinkingContent: (msg.thinkingContent || '') + chunk,
                        loading: false
                      }
                    : {
                        ...msg,
                        content: msg.content + chunk,
                        loading: false,
                        statusText: undefined
                      }
                  : msg
              )
            )
          },
          onEnd: (data) => {
            const currentId = currentMessageIdRef.current
            if (!currentId) return
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === currentId || msg.id === data.message_id
                  ? {
                      ...msg,
                      id: data.message_id,
                      loading: false,
                      statusText: undefined
                    }
                  : msg
              )
            )
          },
          onError: (error) => {
            setError(error)
            const currentId = currentMessageIdRef.current
            if (!currentId) return
            setMessages((prev) => prev.filter((msg) => msg.id !== currentId))
          }
        }

        await chatApi.sendMessageStream(
          conversationId,
          content,
          fileIds.length > 0 ? fileIds : undefined,
          { signal: controller.signal, callbacks },
          enableThinking
        )
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          const currentId = currentMessageIdRef.current
          if (currentId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== currentId))
          }
        } else {
          const errorMessage = err instanceof Error ? err.message : '发送消息失败'
          setError(errorMessage)
          const currentId = currentMessageIdRef.current
          if (currentId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== currentId))
          }
        }
      } finally {
        setIsLoading(false)
        setAbortController(null)
        currentMessageIdRef.current = null
      }
    },
    [conversationId]
  )

  /**
   * 取消当前请求
   */
  const cancelRequest = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsLoading(false)
    }
  }, [abortController])

  /**
   * 清空消息列表
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  /**
   * 添加消息到列表
   */
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  /**
   * 更新消息
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    )
  }, [])

  /**
   * 删除消息
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
  }, [])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    abortController,
    sendMessage,
    cancelRequest,
    clearMessages,
    addMessage,
    updateMessage,
    removeMessage,
    clearError
  }
}
