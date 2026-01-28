import { memo, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import type { BuildCommandResponse } from '@/services/chatApi'
import styles from './ChatInterface.module.css'

export interface BuildLogsProps {
  messageId: string
  buildResult: BuildCommandResponse
  isExpanded: boolean
  onToggle: (isOpen: boolean) => void
  autoScroll?: boolean
}

/**
 * 构建日志组件
 * 显示构建结果和日志，支持自动滚动
 */
export const BuildLogs = memo(
  ({ messageId, buildResult, isExpanded, onToggle, autoScroll = false }: BuildLogsProps) => {
    const preRef = useRef<HTMLPreElement>(null)
    const lastScrollHeightRef = useRef(0)

    // 自动滚动到底部
    useEffect(() => {
      if (!isExpanded || !preRef.current) return

      const scrollToBottom = () => {
        if (preRef.current) {
          preRef.current.scrollTop = preRef.current.scrollHeight
        }
      }

      // 展开时立即滚动到底部
      if (autoScroll) {
        // 使用双重requestAnimationFrame确保DOM完全渲染
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollToBottom)
        })
      }
    }, [isExpanded])

    // 监听日志内容变化，自动滚动到底部
    useEffect(() => {
      if (!autoScroll || !isExpanded || !preRef.current) return

      const currentScrollHeight = preRef.current.scrollHeight

      // 如果滚动高度增加了（有新日志），滚动到底部
      if (currentScrollHeight > lastScrollHeightRef.current) {
        requestAnimationFrame(() => {
          if (preRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = preRef.current
            // 只有在接近底部时才自动滚动（200px以内）
            if (scrollHeight - scrollTop - clientHeight < 200) {
              preRef.current.scrollTop = scrollHeight
            }
          }
        })
      }

      lastScrollHeightRef.current = currentScrollHeight
    }, [autoScroll, isExpanded, buildResult.stdout])

    return (
      <div className={styles.buildResult}>
        <div
          className={clsx(
            styles.buildStatus,
            buildResult.success === true ? styles.success :
            buildResult.success === false ? styles.error :
            styles.building
          )}
        >
          {(() => {
            if (buildResult.success === true) return '✓ 构建成功'
            if (buildResult.success === false) return '✗ 构建失败'
            return '⟳ 构建中...'
          })()}
          <span className={styles.executionTime}>
            ({Math.floor(buildResult.execution_time)}s)
          </span>
        </div>
        <details
          className={styles.buildDetails}
          open={isExpanded}
          onToggle={(e) => {
            const isOpen = (e.target as HTMLDetailsElement).open
            onToggle(isOpen)
          }}
        >
          <summary>{buildResult.phase === 'dev' ? '开发服务器日志' : '构建日志'}</summary>
          <pre ref={preRef} className={styles.buildLog}>
            {buildResult.stdout || buildResult.stderr}
          </pre>
        </details>
      </div>
    )
  },
  // 自定义比较函数：只在关键属性变化时才重渲染
  (prevProps, nextProps) => {
    return (
      prevProps.messageId === nextProps.messageId &&
      prevProps.buildResult.success === nextProps.buildResult.success &&
      prevProps.buildResult.stdout === nextProps.buildResult.stdout &&
      prevProps.buildResult.phase === nextProps.buildResult.phase &&
      prevProps.isExpanded === nextProps.isExpanded &&
      prevProps.autoScroll === nextProps.autoScroll &&
      Math.floor(prevProps.buildResult.execution_time) === Math.floor(nextProps.buildResult.execution_time)
    )
  }
)

BuildLogs.displayName = 'BuildLogs'
