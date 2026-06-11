import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import OpenAI from 'openai'
import { readFile } from 'node:fs/promises'
import { buildRagContext, retrieveTopK, type ExampleDoc } from './rag'
import pkg from '../package.json'

function sanitizeEnv(v: string | undefined) {
  // 去掉首尾空白，并移除包裹用的引号/反引号（常见误填：`https://...` 或 "sk-..."）
  const s = (v ?? '').trim()
  return s.replace(/^['"`]+/, '').replace(/['"`]+$/, '')
}

// 关键：如果你电脑里曾经设置过系统环境变量 DASHSCOPE_API_KEY，
// dotenv 默认不会覆盖它（会导致你改了 .env 但实际仍在用旧 key）。
// 这里显式 override=true，确保以 .env 为准。
dotenv.config({ override: true })

const PORT = Number(process.env.PORT || 8787)
// 阿里百炼（DashScope）OpenAI 兼容模式：
// https://dashscope.aliyuncs.com/compatible-mode/v1
const BASE_URL =
  sanitizeEnv(process.env.DASHSCOPE_BASE_URL) || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const MODEL = sanitizeEnv(process.env.DASHSCOPE_MODEL) || 'qwen3.7-max'
const ENABLE_THINKING = String(process.env.DASHSCOPE_ENABLE_THINKING || '').toLowerCase() === 'true'
const MAX_TOKENS = Number(process.env.GEN_MAX_TOKENS || 1100)

const apiKey = sanitizeEnv(process.env.DASHSCOPE_API_KEY)
const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: BASE_URL,
    })
  : null

type ExampleSeed = {
  id: string
  group: string
  type: string
  tags: string[]
  question: string
  goldAnswer: string
  followUps?: string[]
  rubric?: string[]
}

let _examplesCache: ExampleDoc[] | null = null
async function loadExamples(): Promise<ExampleDoc[]> {
  if (_examplesCache) return _examplesCache
  try {
    // 矩阵生成：20 条 seed × 3 个 seniority = 60 条示例
    const url = new URL('./knowledge/examples_seed.json', import.meta.url)
    const txt = await readFile(url, 'utf-8')
    const seeds = JSON.parse(txt) as ExampleSeed[]
    const seedList = Array.isArray(seeds) ? seeds : []

    const matrix = [
      { seniority: '校招' as const, difficulty: '简单' as const, suffix: 'campus', extra: '（更强调边界清晰与可验证过程）' },
      { seniority: '社招' as const, difficulty: '中等' as const, suffix: 'social', extra: '（更强调取舍与落地闭环）' },
      { seniority: '专家' as const, difficulty: '困难' as const, suffix: 'expert', extra: '（更强调体系化沉淀与规模化复用）' },
    ]

    const expanded: ExampleDoc[] = []
    for (const s of seedList) {
      for (const m of matrix) {
        expanded.push({
          id: `${s.id}__${m.suffix}`,
          group: s.group,
          type: s.type,
          seniority: m.seniority,
          difficulty: m.difficulty,
          tags: Array.isArray(s.tags) ? s.tags : [],
          question: s.question,
          goldAnswer: `${s.goldAnswer}\n【层级提示】${m.seniority}${m.extra}`,
          followUps: s.followUps,
          rubric: s.rubric,
        } as any)
      }
    }

    _examplesCache = expanded
    return _examplesCache
  } catch {
    _examplesCache = []
    return _examplesCache
  }
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: (pkg as any)?.version || 'unknown',
    provider: 'dashscope',
    keyPresent: Boolean(apiKey),
    keyLength: apiKey ? apiKey.length : 0,
    keyTail: apiKey ? apiKey.slice(-4) : '',
    model: MODEL,
    baseURL: BASE_URL,
  })
})

type AnalyzeBody = {
  role?: string
  question?: string
  answer?: string
}

app.post('/api/analyze', async (req, res) => {
  try {
    if (!client) {
      res.status(500).json({
        error:
          '缺少环境变量 DASHSCOPE_API_KEY。请在项目根目录创建 .env 并写入 DASHSCOPE_API_KEY=你的key（阿里百炼）',
      })
      return
    }

    const body = (req.body || {}) as AnalyzeBody
    const role = (body.role || '').trim()
    const question = (body.question || '').trim()
    const answer = (body.answer || '').trim()

    if (!role || !question || !answer) {
      res.status(400).json({ error: 'role/question/answer 不能为空' })
      return
    }

    const examples = await loadExamples()
    const { hits, scored } = retrieveTopK(examples, `${role}\n${question}\n${answer}`, 3)
    const ragContext = buildRagContext(scored)

    const system = `你是一名在 AI 行业拥有多年招聘经验的资深 HR/面试官（覆盖算法/工程/产品/数据等岗位）。
你擅长把“候选人口头回答”打磨成更符合真实面试场景的表达：事实严谨、可验证、突出贡献与影响，并能预判面试官追问。
重要约束：
1) 严禁凭空编造候选人未提供的关键事实（公司名、业务规模、指标数值、具体技术栈等）。若信息缺失，请用【占位符】提示候选人补齐或用“我当时的指标是…（可补充具体数值）”的表达。
2) 改写必须贴合岗位与题目：突出与岗位胜任力直接相关的能力（目标/拆解/方案/权衡/落地/复盘/协作/风险控制）。
3) 语言风格：专业、简洁、逻辑清晰，口语可直接复述；避免空话套话（如“我学习能力强”），必须落到行为与证据。`

    const format = `请严格输出 JSON（不要 markdown，不要代码块），并满足以下结构：
{
  "score": 0-100 的整数,
  "level": "优秀"|"合格"|"需改进",
  "summary": "1-2 句总体评价",
  "highlights": ["答得好的点"...] (1-5条),
  "problems": [{"title":"问题标题","detail":"问题说明","fix":"怎么改"}...] (2-4条),
  "betterAnswer": "给一个可直接口述的改写示例（中文，更贴近真实面试，包含占位符提示补全信息）",
  "followUps": ["面试官下一轮最可能追问的问题"...] (3-6条),
  "rubric": [{"dimension":"维度名","score":0-10整数,"comment":"点评"}...] (4-6条)
}
要求：
1) 结合岗位与题目，评价要具体、可执行；
2) betterAnswer 需要“像真实候选人在面试里说的”，同时控制长度以提升响应速度与可读性：
   - 总字数建议控制在 **450-650 字**（若信息不足，用【占位符】代替，避免编造）
   - 每个小节尽量 2-4 句话，避免长段落
   必须包含以下小节（用换行分段即可）：
   - 【30 秒电梯版】1-3 句：先给结论+核心贡献+结果（若缺数值用【指标】占位符）
   - 【2 分钟标准版（STAR）】按 背景/任务/行动/结果/复盘 组织，其中：
     * 行动要写成 3-5 条步骤，并点出关键决策/取舍/风险控制（如回滚、监控、验证口径）
     * 结果必须可验证：至少给出 2 类证据线索（数据指标/对照组/上线后观测/日志与监控/用户反馈/成本或人效）
   - 【我负责的部分】明确边界：我做了什么、推动了什么、协调了谁（避免“我们做了”）
   - 【可补充信息清单】列 3-6 个【占位符】提示候选人补齐（如【团队规模】【QPS】【故障率】【转化率】【成本节省】【技术栈】）
3) followUps 要贴合该回答的薄弱点，优先追问细节与可验证信息；追问要“尖锐但合理”，像真实面试官会问的。`

    const user = `【目标岗位】${role}\n【面试题】${question}\n【候选人回答】${answer}\n\n${ragContext ? `${ragContext}\n\n` : ''}${format}`

    // 兼容性考虑：部分模型/网关可能不支持 response_format，这里用“强约束 JSON + 容错解析”的方式更稳
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: Number.isFinite(MAX_TOKENS) && MAX_TOKENS > 0 ? MAX_TOKENS : 1100,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // DashScope 扩展参数（OpenAI compatible extra_body）
      extra_body: ENABLE_THINKING ? { enable_thinking: true } : undefined,
    } as any)

    const content = completion.choices?.[0]?.message?.content || '{}'
    // 兜底：截取 JSON 段，避免模型偶尔输出多余文本导致解析失败
    const first = content.indexOf('{')
    const last = content.lastIndexOf('}')
    const jsonText = first >= 0 && last >= 0 && last > first ? content.slice(first, last + 1) : content
    const data = JSON.parse(jsonText)
    // 透出检索命中（便于前端未来展示“参考了哪些示例”，提升可解释性）
    if (hits.length) (data as any).retrieval = hits
    res.json(data)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err)
    res.status(500).json({ error: err?.message || '百炼调用失败' })
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] baseURL=${BASE_URL}`)
  console.log(`[api] model=${MODEL}, thinking=${ENABLE_THINKING}`)
  console.log(`[api] keyPresent=${Boolean(apiKey)}, keyTail=${apiKey ? apiKey.slice(-4) : ''}, keyLength=${apiKey ? apiKey.length : 0}`)
  console.log(`[api] listening on http://localhost:${PORT}`)
})
