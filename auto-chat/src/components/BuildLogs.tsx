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

    // 自动滚动到底部
    useEffect(() => {
      if (autoScroll && isExpanded && preRef.current) {
        requestAnimationFrame(() => {
          if (preRef.current) {
            preRef.current.scrollTop = preRef.current.scrollHeight
          }
        })
      }
    }, [autoScroll, isExpanded])

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
            ({buildResult.execution_time.toFixed(2)}s)
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
  }
)

BuildLogs.displayName = 'BuildLogs'
