import { useCallback } from 'react'
import type { KeyboardOptions } from '@/types/ui'

/**
 * 键盘快捷键处理 Hook
 * 处理常见的键盘快捷键操作
 */
export function useKeyboardShortcuts(
  options: KeyboardOptions = {}
) {
  const { sendKey = 'enter', preventDefault = true } = options

  /**
   * 处理键盘事件，判断是否应该发送消息
   */
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onSend: () => void
    ) => {
      const shouldSend =
        (sendKey === 'enter' && e.key === 'Enter' && !e.shiftKey) ||
        (sendKey === 'ctrl-enter' && e.key === 'Enter' && e.ctrlKey) ||
        (sendKey === 'meta-enter' && e.key === 'Enter' && e.metaKey)

      if (shouldSend) {
        if (preventDefault) {
          e.preventDefault()
        }
        onSend()
      }
    },
    [sendKey, preventDefault]
  )

  return {
    handleKeyDown
  }
}
