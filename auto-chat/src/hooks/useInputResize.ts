import { useState, useCallback, RefObject } from 'react'
import type { ResizeDirection, TextareaSize } from '@/types/ui'

/**
 * 输入框拖拽调整 Hook
 * 处理输入区域的尺寸调整
 */
export function useInputResize(
  inputAreaRef: RefObject<HTMLDivElement>
) {
  const [isResizing, setIsResizing] = useState(false)
  const [textareaSize, setTextareaSize] = useState<TextareaSize>({})

  /**
   * 处理拖拽调整输入区域大小（支持各个方向）
   */
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = inputAreaRef.current?.offsetWidth || 840
    const startHeight = inputAreaRef.current?.offsetHeight || 60

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight

      // 根据方向计算新的尺寸
      if (direction.includes('e')) {
        // 东（右）
        newWidth = Math.max(400, Math.min(1400, startWidth + deltaX))
      }
      if (direction.includes('w')) {
        // 西（左）
        newWidth = Math.max(400, Math.min(1400, startWidth - deltaX))
      }
      if (direction.includes('s')) {
        // 南（下）
        newHeight = Math.max(60, Math.min(800, startHeight + deltaY))
      }
      if (direction.includes('n')) {
        // 北（上）
        newHeight = Math.max(60, Math.min(800, startHeight - deltaY))
      }

      setTextareaSize({ width: newWidth, height: newHeight })

      if (inputAreaRef.current) {
        if (newWidth !== startWidth) {
          inputAreaRef.current.style.width = `${newWidth}px`
        }
        if (newHeight !== startHeight) {
          inputAreaRef.current.style.height = `${newHeight}px`
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [inputAreaRef])

  /**
   * 重置输入框尺寸
   */
  const resetSize = useCallback(() => {
    setTextareaSize({})
    if (inputAreaRef.current) {
      inputAreaRef.current.style.width = ''
      inputAreaRef.current.style.height = ''
    }
  }, [inputAreaRef])

  return {
    isResizing,
    textareaSize,
    handleResizeStart,
    resetSize
  }
}
