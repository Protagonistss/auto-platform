import { ChatContainer } from './components/ChatContainer'
import { ErrorBoundary } from './components/ErrorBoundary'
import styles from './App.module.css'

function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('App 错误:', error, errorInfo)
        }}
      >
        <ChatContainer />
      </ErrorBoundary>
    </div>
  )
}

export default App
