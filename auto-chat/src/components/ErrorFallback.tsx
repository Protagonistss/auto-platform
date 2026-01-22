import { memo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import styles from './ErrorFallback.module.css'

export interface ErrorFallbackProps {
  error: Error
  resetError: () => void
}

/**
 * 错误回退 UI 组件
 * 当组件树中发生错误时显示友好的错误界面
 */
export const ErrorFallback = memo(({ error, resetError }: ErrorFallbackProps) => {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          <AlertCircle size={48} />
        </div>
        <h2 className={styles.errorTitle}>出错了</h2>
        <p className={styles.errorMessage}>
          {error.message || '应用遇到了意外错误，请重试'}
        </p>
        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className={styles.errorDetails}>
            <summary>错误详情</summary>
            <pre>{error.stack}</pre>
          </details>
        )}
        <button onClick={resetError} className={styles.resetButton}>
          <RefreshCw size={16} />
          <span>重新加载</span>
        </button>
      </div>
    </div>
  )
})

ErrorFallback.displayName = 'ErrorFallback'
