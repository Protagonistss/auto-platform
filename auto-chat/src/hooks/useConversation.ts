import { useState, useCallback, useEffect } from 'react'
import { chatApi } from '@/services/chatApi'
import type {
  CreateConversationResponse,
  Conversation,
  ConversationDetail
} from '@/services/chatApi'

/**
 * 会话管理 Hook
 * 处理会话的创建、查询、删除等操作
 */
export function useConversation() {
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<ConversationDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 创建新会话
   */
  const createConversation = useCallback(
    async (title?: string): Promise<CreateConversationResponse> => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await chatApi.createConversation(title)
        setConversationId(result.conversation_id)
        // 刷新会话列表
        await listConversations()
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '创建会话失败'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * 获取会话详情
   */
  const getConversation = useCallback(
    async (id: string): Promise<ConversationDetail> => {
      setIsLoading(true)
      setError(null)
      try {
        const detail = await chatApi.getConversation(id)
        setCurrentConversation(detail)
        return detail
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '获取会话失败'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * 列出所有会话
   */
  const listConversations = useCallback(async (): Promise<Conversation[]> => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await chatApi.listConversations()
      setConversations(list)
      return list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取会话列表失败'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 删除会话
   */
  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      await chatApi.deleteConversation(id)
      // 从列表中移除
      setConversations((prev) => prev.filter((c) => c.id !== id))
      // 如果删除的是当前会话，清空
      if (id === conversationId) {
        setConversationId(undefined)
        setCurrentConversation(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除会话失败'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  /**
   * 设置当前会话 ID
   */
  const setCurrentConversationId = useCallback((id: string | undefined) => {
    setConversationId(id)
    if (id) {
      getConversation(id)
    } else {
      setCurrentConversation(null)
    }
  }, [getConversation])

  /**
   * 重置当前会话（创建新会话）
   */
  const resetConversation = useCallback(async () => {
    try {
      const result = await createConversation('新对话')
      setCurrentConversationId(result.conversation_id)
      return result
    } catch (err) {
      console.error('重置会话失败:', err)
      throw err
    }
  }, [createConversation, setCurrentConversationId])

  return {
    conversationId,
    conversations,
    currentConversation,
    isLoading,
    error,
    createConversation,
    getConversation,
    listConversations,
    deleteConversation,
    setCurrentConversationId,
    resetConversation
  }
}
