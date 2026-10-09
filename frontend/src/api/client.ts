import type { ApiErrorBody } from './types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export class ApiError extends Error {
  code: string
  details: unknown
  status: number

  constructor(message: string, code: string, details: unknown, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }

  static fromResponse(body: ApiErrorBody, status: number): ApiError {
    return new ApiError(body.error.message, body.error.code, body.error.details, status)
  }
}

export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    })
  } catch (err) {
    throw new ApiError('Network error — is the backend running?', 'network', null, 0)
  }

  if (!response.ok) {
    let body: ApiErrorBody
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      throw new ApiError(`HTTP ${response.status}`, 'http_error', null, response.status)
    }
    throw ApiError.fromResponse(body, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}