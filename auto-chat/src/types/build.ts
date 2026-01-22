import type { BuildCommandResponse } from '@/services/chatApi'

/**
 * 构建状态
 */
export type BuildStatus = 'idle' | 'building' | 'success' | 'error'

/**
 * 构建阶段
 */
export type BuildPhase = 'build' | 'dev'

/**
 * 构建状态扩展（包含 null 表示进行中）
 */
export type BuildResultStatus = boolean | null

/**
 * 构建结果信息
 */
export interface BuildResult {
  success: BuildResultStatus
  command: string
  exit_code: number | null
  stdout: string
  stderr: string
  execution_time: number
  message: string
  phase?: BuildPhase
}

/**
 * 构建操作状态
 */
export interface BuildOperationState {
  buildingMessageId: string | null
  writtenMessageIds: Set<string>
  builtMessageIds: Set<string>
  buildResults: Record<string, BuildCommandResponse>
  expandedBuildLogs: Set<string>
  devServerRunning: Set<string>
  exportingMessageIds: Set<string>
}

/**
 * 构建操作回调
 */
export interface BuildOperationCallbacks {
  onBuildStart?: (messageId: string) => void
  onBuildComplete?: (messageId: string, result: BuildCommandResponse) => void
  onBuildError?: (messageId: string, error: string) => void
  onWriteStart?: (messageId: string) => void
  onWriteComplete?: (messageId: string) => void
  onDevServerStart?: (messageId: string) => void
  onDevServerStop?: (messageId: string) => void
  onExportStart?: (messageId: string) => void
  onExportComplete?: (messageId: string, result: BuildCommandResponse) => void
}
