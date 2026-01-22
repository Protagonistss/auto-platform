/**
 * 拖拽方向
 */
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * 输入框尺寸
 */
export interface TextareaSize {
  width?: number
  height?: number
}

/**
 * 思考内容展开状态
 */
export type ThinkingExpandedState = Set<string>

/**
 * 消息列表引用
 */
export interface MessageListRefs {
  messagesEndRef: React.RefObject<HTMLDivElement>
  textareaRef: React.RefObject<HTMLTextAreaElement>
  fileInputRef: React.RefObject<HTMLInputElement>
  inputAreaRef: React.RefObject<HTMLDivElement>
}

/**
 * 键盘事件处理选项
 */
export interface KeyboardOptions {
  /** 发送快捷键 */
  sendKey?: 'enter' | 'ctrl-enter' | 'meta-enter'
  /** 是否阻止默认行为 */
  preventDefault?: boolean
}

/**
 * 文件拖拽状态
 */
export interface DragState {
  isDragging: boolean
  isResizing: boolean
}

/**
 * UI 状态集合
 */
export interface UIState {
  expandedThinking: ThinkingExpandedState
  textareaSize: TextareaSize
  isDragging: boolean
  isResizing: boolean
}
