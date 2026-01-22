import { memo, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, X, ImageIcon, Video, Music, FileText, FileBox } from 'lucide-react'
import { clsx } from 'clsx'
import type { Attachment, ResizeDirection } from '@/types/chat'
import styles from './ChatInterface.module.css'

export interface InputAreaProps {
  input: string
  setInput: (value: string) => void
  attachments: Attachment[]
  onRemoveAttachment: (id: string) => void
  onClearAttachments: () => void
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileSelect?: (files: FileList | null) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  isDragging?: boolean
  textareaSize?: { width?: number; height?: number }
  onResizeStart?: (e: React.MouseEvent, direction: ResizeDirection) => void
  inputAreaRef?: React.RefObject<HTMLDivElement>
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  fileInputRef?: React.RefObject<HTMLInputElement>
}

/**
 * 输入区域组件
 * 处理消息输入、附件上传、拖拽调整大小
 */
export const InputArea = memo(({
  input,
  setInput,
  attachments,
  onRemoveAttachment,
  onClearAttachments,
  onFileInputChange,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onSend,
  disabled = false,
  placeholder = '输入消息...',
  isDragging = false,
  textareaSize = {},
  onResizeStart,
  inputAreaRef,
  textareaRef,
  fileInputRef
}: InputAreaProps) => {
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const localInputAreaRef = useRef<HTMLDivElement>(null)
  const localFileInputRef = useRef<HTMLInputElement>(null)

  const activeTextareaRef = textareaRef || localTextareaRef
  const activeInputAreaRef = inputAreaRef || localInputAreaRef
  const activeFileInputRef = fileInputRef || localFileInputRef

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={20} />
    if (type.startsWith('video/')) return <Video size={20} />
    if (type.startsWith('audio/')) return <Music size={20} />
    if (type.includes('pdf') || type.includes('word') || type.includes('document')) return <FileText size={20} />
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return <FileBox size={20} />
    return <FileText size={20} />
  }

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInput(textarea.value)

    // 如果用户设置了固定尺寸，则不自动调整
    if (textareaSize.width || textareaSize.height) return

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 200)
    textarea.style.height = `${newHeight}px`
  }, [setInput, textareaSize])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }, [onSend])

  return (
    <div
      className={clsx(styles.inputContainer, isDragging && styles.dragging)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        ref={activeInputAreaRef}
        className={styles.inputArea}
        style={{
          width: textareaSize.width ? `${textareaSize.width}px` : undefined,
          height: textareaSize.height ? `${textareaSize.height}px` : undefined,
        }}
      >
        {/* 拖拽手柄 */}
        {onResizeStart && (
          <div className={styles.resizeHandles}>
            <div
              className={clsx(styles.resizeHandle, styles.se)}
              onMouseDown={(e) => onResizeStart(e, 'se')}
              title="向右下拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.sw)}
              onMouseDown={(e) => onResizeStart(e, 'sw')}
              title="向左下拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.ne)}
              onMouseDown={(e) => onResizeStart(e, 'ne')}
              title="向右上拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.nw)}
              onMouseDown={(e) => onResizeStart(e, 'nw')}
              title="向左上拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.n)}
              onMouseDown={(e) => onResizeStart(e, 'n')}
              title="向上拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.s)}
              onMouseDown={(e) => onResizeStart(e, 's')}
              title="向下拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.e)}
              onMouseDown={(e) => onResizeStart(e, 'e')}
              title="向右拖拽"
            />
            <div
              className={clsx(styles.resizeHandle, styles.w)}
              onMouseDown={(e) => onResizeStart(e, 'w')}
              title="向左拖拽"
            />
          </div>
        )}

        {/* 附件预览 */}
        {attachments.length > 0 && (
          <div className={styles.attachmentsPreview}>
            {attachments.map((attachment) => (
              <div key={attachment.id} className={styles.attachmentPreview}>
                <span className={styles.attachmentIcon}>{getFileIcon(attachment.type)}</span>
                <span className={styles.attachmentName}>{attachment.name}</span>
                <button
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className={styles.removeAttachment}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区域 */}
        <div className={styles.inputWrapper}>
          <input
            ref={activeFileInputRef}
            type="file"
            multiple
            onChange={onFileInputChange}
            className={styles.fileInput}
          />
          <button
            onClick={() => activeFileInputRef.current?.click()}
            className={styles.attachButton}
            title="添加附件"
          >
            <Paperclip size={20} />
          </button>
          <div className={styles.textareaWrapper}>
            <textarea
              ref={activeTextareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={isDragging ? '松开以上传文件' : placeholder}
              disabled={disabled}
              className={styles.textarea}
              rows={1}
            />
          </div>
          <button
            onClick={onSend}
            disabled={(!input.trim() && attachments.length === 0) || disabled}
            className={styles.sendButton}
          >
            {disabled ? <span className={styles.spin}>⏳</span> : <Send size={20} />}
          </button>
        </div>

        {/* 提示文本 */}
        <div className={styles.inputHint}>
          按 Enter 发送，Shift + Enter 换行
        </div>
      </div>
    </div>
  )
})

InputArea.displayName = 'InputArea'
