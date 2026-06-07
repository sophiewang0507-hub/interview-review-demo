import type { ReviewLevel, ReviewResult } from './analyze'

export type HistoryItem = {
  id: string
  createdAt: number
  role: string
  question: string
  answer: string
  score: number
  level: ReviewLevel
  result: ReviewResult
}

const STORAGE_KEY = 'interview_review_history_v1'
const MAX_ITEMS = 80

function safeJsonParse<T>(text: string | null): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function newId() {
  // 浏览器环境优先用 randomUUID
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function loadHistory(): HistoryItem[] {
  const raw = safeJsonParse<HistoryItem[]>(localStorage.getItem(STORAGE_KEY))
  if (!raw || !Array.isArray(raw)) return []

  // 轻量校验，避免旧数据/脏数据导致页面异常
  return raw
    .filter((x) => x && typeof x.id === 'string' && typeof x.createdAt === 'number')
    .map((x) => ({
      id: x.id,
      createdAt: x.createdAt,
      role: String(x.role || ''),
      question: String(x.question || ''),
      answer: String(x.answer || ''),
      score: Number.isFinite(x.score) ? Number(x.score) : Number(x.result?.score || 0),
      level: (x.level || x.result?.level || '需改进') as ReviewLevel,
      result: x.result as ReviewResult,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ITEMS)
}

export function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function addHistory(item: HistoryItem) {
  const items = loadHistory()
  items.unshift(item)
  saveHistory(items)
  return items
}

export function removeHistory(id: string) {
  const items = loadHistory().filter((x) => x.id !== id)
  saveHistory(items)
  return items
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}

