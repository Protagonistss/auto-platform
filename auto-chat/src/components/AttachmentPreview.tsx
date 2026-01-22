import { memo } from 'react'
import { ImageIcon, Video, Music, FileText, FileBox } from 'lucide-react'
import { clsx } from 'clsx'
import type { Attachment } from '@/types/chat'
import styles from './ChatInterface.module.css'

export interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove?: (id: string) => void
  showRemove?: boolean
}

/**
 * 附件预览组件
 * 显示附件信息，支持移除操作
 */
export const AttachmentPreview = memo(({ attachment, onRemove, showRemove = true }: AttachmentPreviewProps) => {
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

  return (
    <div className={styles.attachment}>
      <span className={styles.attachmentIcon}>
        {getFileIcon(attachment.type)}
      </span>
      <div className={styles.attachmentInfo}>
        <div className={styles.attachmentName}>{attachment.name}</div>
        <div className={styles.attachmentSize}>
          {formatFileSize(attachment.size)}
        </div>
      </div>
    </div>
  )
})

AttachmentPreview.displayName = 'AttachmentPreview'
