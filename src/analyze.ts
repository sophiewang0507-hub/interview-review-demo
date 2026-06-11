export type ReviewLevel = '优秀' | '合格' | '需改进'

export type RubricItem = {
  dimension: string
  score: number // 0-10
  comment: string
}

export type ProblemItem = {
  title: string
  detail: string
  fix: string
}

export type RetrievalHit = {
  id: string
  score: number
  tags: string[]
  question: string
  group?: string
  type?: string
  difficulty?: '简单' | '中等' | '困难'
  seniority?: '校招' | '社招' | '专家'
}

export type ReviewResult = {
  score: number // 0-100
  level: ReviewLevel
  summary: string
  highlights: string[]
  problems: ProblemItem[]
  betterAnswer: string
  followUps: string[]
  rubric: RubricItem[]
  retrieval?: RetrievalHit[]
}

export type AnalyzeInput = {
  role: string
  question: string
  answer: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function ensureStringArray(x: any, max = 8): string[] {
  if (!Array.isArray(x)) return []
  return x
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max)
}

function normalizeResult(raw: any): ReviewResult {
  const score = clamp(Number.isFinite(raw?.score) ? Math.round(raw.score) : 0, 0, 100)
  const level: ReviewLevel = raw?.level === '优秀' || raw?.level === '合格' || raw?.level === '需改进' ? raw.level : '需改进'

  const highlights = ensureStringArray(raw?.highlights, 6)
  const followUps = ensureStringArray(raw?.followUps, 10)

  const problems: ProblemItem[] = Array.isArray(raw?.problems)
    ? raw.problems
        .map((p: any) => ({
          title: typeof p?.title === 'string' ? p.title : '问题',
          detail: typeof p?.detail === 'string' ? p.detail : '',
          fix: typeof p?.fix === 'string' ? p.fix : '',
        }))
        .filter((p: ProblemItem) => p.title && (p.detail || p.fix))
        .slice(0, 8)
    : []

  const rubric: RubricItem[] = Array.isArray(raw?.rubric)
    ? raw.rubric
        .map((r: any) => ({
          dimension: typeof r?.dimension === 'string' ? r.dimension : '维度',
          score: clamp(Number.isFinite(r?.score) ? Math.round(r.score) : 0, 0, 10),
          comment: typeof r?.comment === 'string' ? r.comment : '',
        }))
        .filter((r: RubricItem) => r.dimension)
        .slice(0, 8)
    : []

  const retrieval: RetrievalHit[] = Array.isArray(raw?.retrieval)
    ? raw.retrieval
        .map((r: any) => ({
          id: typeof r?.id === 'string' ? r.id : '',
          score: Number.isFinite(r?.score) ? Number(r.score) : 0,
          tags: Array.isArray(r?.tags) ? r.tags.filter((x: any) => typeof x === 'string').slice(0, 8) : [],
          question: typeof r?.question === 'string' ? r.question : '',
          group: typeof r?.group === 'string' ? r.group : undefined,
          type: typeof r?.type === 'string' ? r.type : undefined,
          difficulty:
            r?.difficulty === '简单' || r?.difficulty === '中等' || r?.difficulty === '困难' ? r.difficulty : undefined,
          seniority: r?.seniority === '校招' || r?.seniority === '社招' || r?.seniority === '专家' ? r.seniority : undefined,
        }))
        .filter((x: RetrievalHit) => x.id && x.question)
        .slice(0, 5)
    : []

  return {
    score,
    level,
    summary: typeof raw?.summary === 'string' ? raw.summary : '',
    highlights: highlights.length ? highlights : ['（模型未返回 highlights）'],
    problems: problems.length
      ? problems
      : [
          {
            title: '（模型未返回 problems）',
            detail: '可在后端 server/index.ts 调整提示词与约束。',
            fix: '检查 OpenAI Key / 模型 / 网络，并重试。',
          },
        ],
    betterAnswer: typeof raw?.betterAnswer === 'string' ? raw.betterAnswer : '',
    followUps: followUps.length ? followUps : ['（模型未返回 followUps）'],
    rubric: rubric.length
      ? rubric
      : [
          { dimension: '结构清晰', score: 0, comment: '' },
          { dimension: '细节可验证', score: 0, comment: '' },
          { dimension: '结果与影响', score: 0, comment: '' },
          { dimension: '岗位匹配', score: 0, comment: '' },
        ],
    retrieval: retrieval.length ? retrieval : undefined,
  }
}

export async function analyzeAnswer(input: AnalyzeInput): Promise<ReviewResult> {
  const base = (import.meta as any).env?.VITE_API_BASE || ''
  const url = `${base}/api/analyze`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!resp.ok) {
    let msg = `请求失败：${resp.status}`
    try {
      const err = await resp.json()
      if (err?.error) msg = String(err.error)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const raw = await resp.json()
  return normalizeResult(raw)
}
