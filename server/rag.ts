export type ExampleDoc = {
  id: string
  tags: string[]
  group?: string
  type?: string
  difficulty?: '简单' | '中等' | '困难'
  seniority?: '校招' | '社招' | '专家'
  question: string
  goldAnswer: string
  followUps?: string[]
  rubric?: string[]
}

export type RetrievalHit = {
  id: string
  score: number
  tags: string[]
  group?: string
  type?: string
  difficulty?: '简单' | '中等' | '困难'
  seniority?: '校招' | '社招' | '专家'
  question: string
}

function norm(s: string) {
  return (s || '').toLowerCase()
}

export function extractKeywords(text: string): string[] {
  const t = norm(text)

  // 中文短语（2-6字）
  const zh = [...t.matchAll(/[\u4e00-\u9fa5]{2,6}/g)].map((m) => m[0])
  // 英文单词（>=3）
  const en = [...t.matchAll(/[a-z]{3,}/g)].map((m) => m[0])

  const stop = new Set([
    '面试',
    '回答',
    '问题',
    '怎么',
    '如何',
    '一次',
    '经历',
    '可以',
    '我们',
    '他们',
    '这个',
    '那个',
    '进行',
    '以及',
    '然后',
    '需要',
  ])

  const all = [...zh, ...en]
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !stop.has(x))

  // 去重并保持顺序
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const k of all) {
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
  }

  return uniq.slice(0, 20)
}

export function scoreExample(example: ExampleDoc, keywords: string[]): number {
  const hay = norm(
    [
      example.group || '',
      example.type || '',
      example.seniority || '',
      example.difficulty || '',
      example.question,
      ...(example.tags || []),
    ].join('\n'),
  )
  let score = 0
  for (const k of keywords) {
    if (!k) continue
    if (hay.includes(norm(k))) score += k.length <= 2 ? 1 : 2
  }
  // tags 命中加权
  for (const tag of example.tags || []) {
    if (keywords.includes(tag)) score += 2
  }
  return score
}

export function retrieveTopK(examples: ExampleDoc[], queryText: string, k = 3) {
  const keywords = extractKeywords(queryText)
  const scored = examples
    .map((ex) => ({ ex, s: scoreExample(ex, keywords) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)

  const hits: RetrievalHit[] = scored.map((x) => ({
    id: x.ex.id,
    score: x.s,
    tags: x.ex.tags || [],
    group: x.ex.group,
    type: x.ex.type,
    difficulty: x.ex.difficulty,
    seniority: x.ex.seniority,
    question: x.ex.question,
  }))

  return { hits, scored }
}

export function buildRagContext(scored: { ex: ExampleDoc; s: number }[]) {
  if (!scored.length) return ''
  const parts = scored.map(({ ex, s }, idx) => {
    const follow = (ex.followUps || []).slice(0, 4).map((q) => `- ${q}`).join('\n')
    const rubric = (ex.rubric || []).slice(0, 6).map((r) => `- ${r}`).join('\n')
    return [
      `【参考示例 ${idx + 1}】id=${ex.id} score=${s}`,
      `tags=${(ex.tags || []).join(' / ')}`,
      `题目：${ex.question}`,
      `高质量回答模板（仅供结构与颗粒度参考，禁止编造事实）：\n${ex.goldAnswer}`,
      rubric ? `评分要点：\n${rubric}` : '',
      follow ? `常见追问：\n${follow}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return `【参考示例库命中】（仅用于结构/表达参考，严禁凭空补事实；缺失信息请用【占位符】提示候选人补齐）\n\n${parts.join(
    '\n\n',
  )}`
}
