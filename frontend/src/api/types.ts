// Types mirroring the backend pydantic models (app/models/schemas.py).

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'area'

export interface ColumnProfile {
  name: string
  dtype: string
  null_pct: number
  unique_count: number
  min?: unknown | null
  max?: unknown | null
  mean?: number | null
  top_values: Array<{ value: unknown; count: number }>
}

export interface DatasetProfile {
  row_count: number
  column_count: number
  columns: ColumnProfile[]
  sample_rows: Record<string, unknown>[]
  quality_score: number
  quality_issues: string[]
}

export interface DatasetInfo {
  file_id: string
  filename: string
  table_name: string
  size_bytes: number
  uploaded_at: string
  profile: DatasetProfile
}

export interface SessionOut {
  session_id: string
  created_at: string
  name: string | null
}

export interface FileListResponse {
  session_id: string
  datasets: DatasetInfo[]
}

export interface ChartSeries {
  name: string
  data: unknown[]
}

export interface ChartSpec {
  chart_type: ChartType
  title: string
  x: string
  series: ChartSeries[]
  x_type: 'linear' | 'category' | 'time'
  y_label?: string | null
  data: Record<string, unknown>[]
}

export interface AnomalyRow {
  row_index: number
  reasons: string[]
  values: Record<string, unknown>
}

export interface AnomalyReport {
  dataset: string
  method: string
  columns: string[]
  flagged_count: number
  total_count: number
  rows: AnomalyRow[]
}

export interface DataQualityReport {
  dataset: string
  row_count: number
  column_count: number
  duplicate_rows: number
  nulls: Record<string, number>
  constant_columns: string[]
  outliers: Record<string, number>
  type_mismatches: string[]
  score: number
}

export interface TableResult {
  title: string
  columns: string[]
  rows: unknown[][]
  truncated: boolean
}

export interface FinalAnswer {
  answer: string
  insights: string[]
  sql?: string | null
  pandas_code?: string | null
  charts: ChartSpec[]
  tables: TableResult[]
  anomalies: AnomalyReport[]
  reasoning: string[]
  follow_up_suggestions: string[]
}

export interface ChatResponse {
  session_id: string
  final: FinalAnswer
  iterations: number
  tool_calls: Array<Record<string, unknown>>
}

export interface HealthResponse {
  status: string
  version: string
  llm_provider: string
  llm_configured: boolean
}

export interface QueryHistoryEntry {
  sql: string
  rows: number
  elapsed_ms: number
  at: number
}

export interface InspectorSnapshot {
  session_id: string
  quality: DataQualityReport[]
  query_history: QueryHistoryEntry[]
  pinned_charts: ChartSpec[]
}

// SSE chat events emitted by the backend agent loop.
export type ChatEventType =
  | 'status'
  | 'tool_call'
  | 'chart'
  | 'anomaly'
  | 'final'
  | 'error'

export interface ChatStatusEvent {
  type: 'status'
  message: string
}

export interface ChatToolCallEvent {
  type: 'tool_call'
  name: string
  args: Record<string, unknown>
  iteration: number
}

export interface ChatChartEvent {
  type: 'chart'
  chart: ChartSpec
}

export interface ChatAnomalyEvent {
  type: 'anomaly'
  anomaly: AnomalyReport
}

export interface ChatFinalEvent {
  type: 'final'
  final: FinalAnswer
  iterations: number
}

export interface ChatErrorEvent {
  type: 'error'
  message: string
  code: string
}

export type ChatEvent =
  | ChatStatusEvent
  | ChatToolCallEvent
  | ChatChartEvent
  | ChatAnomalyEvent
  | ChatFinalEvent
  | ChatErrorEvent

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
    request_id?: string
  }
}