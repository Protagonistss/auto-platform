import { useCallback, useLayoutEffect, useRef } from 'react'
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
 * 
 * 注意：此组件不使用 memo，因为父组件 MessageItem 已经有 memo 保护
 * 避免过度优化导致的状态同步问题
 */
export function BuildLogs({ messageId, buildResult, isExpanded, onToggle, autoScroll = false }: BuildLogsProps) {
    const preRef = useRef<HTMLPreElement>(null)
    const lastScrollHeightRef = useRef(0)
    const detailsRef = useRef<HTMLDetailsElement>(null)
    const isPinnedToBottomRef = useRef(true)
    const isAutoScrollingRef = useRef(false)
    const scrollAnimationRef = useRef<number | null>(null)
    const initialExpandedRef = useRef(isExpanded)

    // 同步 details 的 open 状态
    useLayoutEffect(() => {
      if (detailsRef.current && detailsRef.current.open !== isExpanded) {
        detailsRef.current.open = isExpanded
      }
    }, [isExpanded])

    // details ref callback，初始化时设置正确的 open 状态
    const detailsRefCallback = useCallback((element: HTMLDetailsElement | null) => {
      if (element) {
        element.open = initialExpandedRef.current
      }
      detailsRef.current = element
    }, [])

    const cancelScrollAnimation = useCallback(() => {
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current)
        scrollAnimationRef.current = null
      }
      isAutoScrollingRef.current = false
    }, [])

    const startAutoScroll = useCallback(() => {
      const element = preRef.current
      if (!element) return

      if (scrollAnimationRef.current !== null) return

      const step = () => {
        const current = element.scrollTop
        const target = Math.max(0, element.scrollHeight - element.clientHeight)
        const delta = target - current

        if (!isPinnedToBottomRef.current) {
          cancelScrollAnimation()
          return
        }

        if (Math.abs(delta) < 1) {
          element.scrollTop = target
          cancelScrollAnimation()
          return
        }

        const factor = Math.min(1, Math.max(0.25, Math.abs(delta) / 600))
        isAutoScrollingRef.current = true
        element.scrollTop = current + delta * factor
        scrollAnimationRef.current = requestAnimationFrame(step)
      }

      scrollAnimationRef.current = requestAnimationFrame(step)
    }, [cancelScrollAnimation])

    const scrollToBottom = useCallback(() => {
      isPinnedToBottomRef.current = true
      startAutoScroll()
      if (preRef.current) {
        lastScrollHeightRef.current = preRef.current.scrollHeight
      }
    }, [startAutoScroll])

    useLayoutEffect(() => {
      return () => {
        cancelScrollAnimation()
      }
    }, [cancelScrollAnimation])

    // 展开时立即滚动到底部
    useLayoutEffect(() => {
      if (!isExpanded || !preRef.current) return
      scrollToBottom()
    }, [isExpanded, scrollToBottom])

    // 日志内容变化时自动滚动
    useLayoutEffect(() => {
      if (!isExpanded || !preRef.current) return

      const currentScrollHeight = preRef.current.scrollHeight

      if (autoScroll) {
        isPinnedToBottomRef.current = true
        scrollToBottom()
        lastScrollHeightRef.current = currentScrollHeight
        return
      }

      // 如果内容增加了，且仍保持在底部，则自动滚动到底部
      if (currentScrollHeight > lastScrollHeightRef.current) {
        if (isPinnedToBottomRef.current) {
          scrollToBottom()
        }
        lastScrollHeightRef.current = currentScrollHeight
      }
    }, [isExpanded, buildResult.stdout, buildResult.stderr, scrollToBottom, autoScroll])

    const handleScroll = useCallback(() => {
      if (autoScroll) return
      if (isAutoScrollingRef.current) return
      const element = preRef.current
      if (!element) return
      const { scrollTop, scrollHeight, clientHeight } = element
      // 用户手动上滑则解除“粘底”，回到底部再恢复
      isPinnedToBottomRef.current = scrollHeight - scrollTop - clientHeight < 50
    }, [autoScroll])

    const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      const isOpen = (e.currentTarget as HTMLDetailsElement).open
      onToggle(isOpen)
    }

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
            if (buildResult.phase === 'dev') {
              if (buildResult.message) return buildResult.message
              if (buildResult.success === true) return '服务已启动'
              if (buildResult.success === false) return '服务启动失败'
              return '服务启动中...'
            }
            if (buildResult.phase === 'export') {
              if (buildResult.message) return buildResult.message
              if (buildResult.success === true) return '✓ 导出成功'
              if (buildResult.success === false) return '✗ 导出失败'
              return '⟳ 导出中...'
            }
            if (buildResult.success === true) return '✓ 构建成功'
            if (buildResult.success === false) return '✗ 构建失败'
            return '⟳ 构建中...'
          })()}
          <span className={styles.executionTime}>
            ({Math.floor(buildResult.execution_time)}s)
          </span>
        </div>
        <details
          ref={detailsRefCallback}
          className={styles.buildDetails}
          onToggle={handleToggle}
        >
          <summary>
            {buildResult.phase === 'dev' ? '开发服务器日志' :
             buildResult.phase === 'export' ? '导出日志' :
             '构建日志'}
          </summary>
          <pre ref={preRef} className={styles.buildLog} onScroll={handleScroll}>
            {buildResult.stdout || buildResult.stderr}
          </pre>
        </details>
      </div>
    )
}
