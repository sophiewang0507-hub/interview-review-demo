import OpenAI from 'openai'
import examplesSeed from '../../server/knowledge/examples_seed.json'
import { buildRagContext, retrieveTopK, type ExampleDoc } from '../../server/rag'

function env(name: string) {
  const netlifyEnv = (globalThis as any).Netlify?.env
  return String(netlifyEnv?.get?.(name) ?? process.env[name] ?? '').trim().replace(/^['"`]+/, '').replace(/['"`]+$/, '')
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

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

type AnalyzeBody = {
  role?: string
  question?: string
  answer?: string
}

function loadExamples(): ExampleDoc[] {
  const matrix = [
    { seniority: '校招' as const, difficulty: '简单' as const, suffix: 'campus', extra: '更强调边界清晰与可验证过程' },
    { seniority: '社招' as const, difficulty: '中等' as const, suffix: 'social', extra: '更强调取舍与落地闭环' },
    { seniority: '专家' as const, difficulty: '困难' as const, suffix: 'expert', extra: '更强调体系化沉淀与规模化复用' },
  ]

  const expanded: ExampleDoc[] = []
  for (const seed of examplesSeed as ExampleSeed[]) {
    for (const item of matrix) {
      expanded.push({
        id: `${seed.id}__${item.suffix}`,
        group: seed.group,
        type: seed.type,
        seniority: item.seniority,
        difficulty: item.difficulty,
        tags: Array.isArray(seed.tags) ? seed.tags : [],
        question: seed.question,
        goldAnswer: `${seed.goldAnswer}\n【层级提示】${item.seniority}：${item.extra}`,
        followUps: seed.followUps,
        rubric: seed.rubric,
      })
    }
  }

  return expanded
}

async function analyze(req: Request) {
  const apiKey = env('DASHSCOPE_API_KEY')
  const baseURL = env('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = env('DASHSCOPE_MODEL') || 'qwen-plus'
  const enableThinking = env('DASHSCOPE_ENABLE_THINKING').toLowerCase() === 'true'

  if (!apiKey) {
    return json({ error: '缺少环境变量 DASHSCOPE_API_KEY。请在 Netlify 项目的环境变量中添加该 Key。' }, 500)
  }

  const body = (await req.json().catch(() => ({}))) as AnalyzeBody
  const role = (body.role || '').trim()
  const question = (body.question || '').trim()
  const answer = (body.answer || '').trim()

  if (!role || !question || !answer) {
    return json({ error: 'role/question/answer 不能为空' }, 400)
  }

  const examples = loadExamples()
  const { hits, scored } = retrieveTopK(examples, `${role}\n${question}\n${answer}`, 3)
  const ragContext = buildRagContext(scored)

  const client = new OpenAI({ apiKey, baseURL })
  const prompt = `你是一名有多年招聘经验的中文面试官。请评价候选人的回答，并给出可直接复述的改写版本。

要求：
1. 不要编造候选人没有提供的事实、公司名、指标或技术细节；缺失信息用【占位符】提示补充。
2. 评价要贴合目标岗位和面试题，指出具体问题、修正方式和可能追问。
3. 只输出 JSON，不要 markdown，不要代码块。

输出结构：
{
  "score": 0-100 的整数,
  "level": "优秀"|"合格"|"需改进",
  "summary": "1-2 句总体评价",
  "highlights": ["做得好的点"],
  "problems": [{"title":"问题标题","detail":"问题说明","fix":"怎么改"}],
  "betterAnswer": "包含 30 秒电梯版、1 分钟 STAR 标准版、我负责的部分、可补充信息清单",
  "followUps": ["面试官可能追问的问题"],
  "rubric": [{"dimension":"维度名","score":0-10,"comment":"点评"}]
}`

  const user = `【目标岗位】${role}
【面试题】${question}
【候选人回答】${answer}

${ragContext ? `${ragContext}\n\n` : ''}${prompt}`

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: user },
    ],
    extra_body: enableThinking ? { enable_thinking: true } : undefined,
  } as any)

  const content = completion.choices?.[0]?.message?.content || '{}'
  const first = content.indexOf('{')
  const last = content.lastIndexOf('}')
  const jsonText = first >= 0 && last >= 0 && last > first ? content.slice(first, last + 1) : content
  const data = JSON.parse(jsonText)
  if (hits.length) data.retrieval = hits

  return json(data)
}

export default async (req: Request) => {
  const url = new URL(req.url)
  const apiKey = env('DASHSCOPE_API_KEY')
  const baseURL = env('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = env('DASHSCOPE_MODEL') || 'qwen-plus'

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json({
      ok: true,
      provider: 'dashscope',
      keyPresent: Boolean(apiKey),
      keyLength: apiKey ? apiKey.length : 0,
      keyTail: apiKey ? apiKey.slice(-4) : '',
      model,
      baseURL,
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    try {
      return await analyze(req)
    } catch (error: any) {
      console.error(error)
      return json({ error: error?.message || '分析调用失败' }, 500)
    }
  }

  return json({ error: 'Not found' }, 404)
}

export const config = {
  path: '/api/*',
}
