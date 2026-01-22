import { useState, useCallback } from 'react'
import type { Attachment } from '@/types/chat'

/**
 * 文件上传 Hook
 * 处理文件选择、附件管理和拖拽上传
 */
export function useFileUpload() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file
    }))

    setAttachments((prev) => [...prev, ...newAttachments])
  }, [])

  /**
   * 移除附件
   */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id))
  }, [])

  /**
   * 清空所有附件
   */
  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  /**
   * 处理拖拽事件
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  return {
    attachments,
    isDragging,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
