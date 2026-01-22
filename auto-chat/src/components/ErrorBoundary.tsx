import { Component, ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，显示友好的错误界面
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo)

    // 调用自定义错误处理回调
    this.props.onError?.(error, errorInfo)

    // 可以在这里将错误日志发送到错误追踪服务
    // logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    })
  }

  render() {
    if (this.state.hasError) {
      // 使用自定义回退 UI 或默认的 ErrorFallback
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error || new Error('未知错误')}
          resetError={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
