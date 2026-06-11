import './style.css'
import { analyzeAnswerStream, type RetrievalHit, type ReviewResult } from './analyze'
import { addHistory, clearHistory, loadHistory, newId, removeHistory, type HistoryItem } from './history'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app not found')

app.innerHTML = `
  <div class="page">
    <svg class="sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <symbol id="i-spark" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 2l1.2 5.1L18 9l-4.8 1.9L12 16l-1.2-5.1L6 9l4.8-1.9L12 2z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M19.5 13.5l.6 2.4L22 17l-1.9 1.1-.6 2.4-.6-2.4L17 17l1.9-1.1.6-2.4z" />
      </symbol>
      <symbol id="i-briefcase" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M9 6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V6z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M3 12h18" />
      </symbol>
      <symbol id="i-question" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 18h.01" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.2 1.2-1.2 2.2v.5" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10z" />
      </symbol>
      <symbol id="i-message" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </symbol>
      <symbol id="i-wand" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M3 21l9-9" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M14 8l2-2 2 2-2 2-2-2z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 10l2 2" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M5 12l2 2" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M7 10l2-2" />
      </symbol>
      <symbol id="i-eraser" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M20 20H9l-6-6 9-9a2 2 0 0 1 2.8 0l5.2 5.2a2 2 0 0 1 0 2.8l-7 7z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M7 17l3 3" />
      </symbol>
      <symbol id="i-copy" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M9 9h10v10H9z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
          d="M20 6L9 17l-5-5" />
      </symbol>
      <symbol id="i-alert" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 9v4" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 17h.01" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M10.3 4.3a2 2 0 0 1 3.4 0l8 13.9A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-2.8l8-13.9z" />
      </symbol>
      <symbol id="i-search" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M21 21l-4.3-4.3" />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M3 6h18" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M6 6l1 16h10l1-16" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M10 11v6M14 11v6" />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 6v6l4 2" />
      </symbol>
      <symbol id="i-sort" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M7 7h10M7 12h7M7 17h4" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M18 16l2 2 2-2" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M20 6v12" />
      </symbol>
      <symbol id="i-history" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M3 12a9 9 0 1 0 3-6.7" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M3 3v6h6" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M12 7v6l4 2" />
      </symbol>
      <symbol id="i-book" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M4 19a2 2 0 0 0 2 2h12" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M6 2h12a2 2 0 0 1 2 2v16H6a2 2 0 0 0-2 2V4a2 2 0 0 1 2-2z" />
        <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          d="M8 6h10M8 10h10M8 14h8" />
      </symbol>
    </svg>

    <header class="header">
      <div class="brand">
        <div class="logo" aria-hidden="true">
          <svg class="logo-icon"><use href="#i-spark"></use></svg>
        </div>
        <div>
          <div class="title">AI 面试复盘助手</div>
          <div class="subtitle">极简、高端的复盘体验：定位问题、给出改写、预测追问</div>
        </div>
      </div>
      <div class="header-actions">
        <button id="btnFill" class="btn btn-ghost" type="button">载入示例</button>
      </div>
    </header>

    <main class="main">
      <aside class="card sidebar" aria-label="历史记录">
        <div class="card-head">
          <h2 class="card-title">历史</h2>
          <div class="card-desc">自动保存 · 可检索 · 可重开</div>
        </div>

        <div class="history-toolbar">
          <div class="history-search">
            <svg class="icon"><use href="#i-search"></use></svg>
            <input id="histSearch" class="input input-compact" placeholder="搜索岗位 / 题目" />
          </div>

          <div class="history-actions">
            <label class="history-sort" title="排序">
              <svg class="icon"><use href="#i-sort"></use></svg>
              <select id="histSort" class="select">
                <option value="recent">最近</option>
                <option value="scoreDesc">分数高→低</option>
                <option value="scoreAsc">分数低→高</option>
              </select>
            </label>
            <button id="histClearAll" class="btn btn-ghost btn-small" type="button" title="清空全部">
              <svg class="btn-icon"><use href="#i-trash"></use></svg>
              清空
            </button>
          </div>
        </div>

        <div id="histList" class="history-list"></div>
      </aside>

      <section class="card card-input">
        <div class="card-head">
          <h2 class="card-title">输入</h2>
          <div class="card-desc">三步即可得到高质量复盘：岗位 · 题目 · 回答</div>
        </div>

        <div class="form">
          <label class="field">
            <div class="field-head">
              <svg class="icon"><use href="#i-briefcase"></use></svg>
              <div class="label">目标岗位</div>
            </div>
            <input id="role" class="input" placeholder="例如：后端开发 / 前端开发 / 产品经理 / 数据分析..." />
          </label>

          <label class="field">
            <div class="field-head">
              <svg class="icon"><use href="#i-question"></use></svg>
              <div class="label">面试题</div>
            </div>
            <textarea id="question" class="textarea" rows="3" placeholder="例如：讲讲你做过一次线上故障处理的经历，你是怎么做的？"></textarea>
          </label>

          <label class="field">
            <div class="field-head">
              <svg class="icon"><use href="#i-message"></use></svg>
              <div class="label">你的回答</div>
            </div>
            <textarea id="answer" class="textarea" rows="8" placeholder="把你在面试中说的原话粘贴进来（越真实越好）"></textarea>
          </label>
        </div>

        <div class="actions">
          <button id="btnAnalyze" class="btn btn-primary" type="button">
            <svg class="btn-icon"><use href="#i-wand"></use></svg>
            生成复盘
          </button>
          <button id="btnClear" class="btn btn-ghost" type="button">
            <svg class="btn-icon"><use href="#i-eraser"></use></svg>
            清空
          </button>
          <div id="hint" class="hint" aria-live="polite"></div>
        </div>
      </section>

      <section class="card card-output">
        <div class="card-head">
          <h2 class="card-title">输出</h2>
          <div class="card-desc">评分、问题定位、可口述改写与下一轮追问</div>
        </div>
        <div id="output" class="output empty">
          <div class="empty-title">等待输入</div>
          <div class="empty-subtitle">填写左侧内容后点击「生成复盘」</div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="footer-row">
        <div>说明：本 Demo 通过后端代理调用阿里百炼（DashScope）；如果无法输出，请先确认后端 API 已启动且 .env 中已配置 DASHSCOPE_API_KEY。</div>
        <div id="apiStatus" class="api-status">API: 检测中…</div>
      </div>
    </footer>
  </div>
`

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}

const roleEl = $('role') as HTMLInputElement
const questionEl = $('question') as HTMLTextAreaElement
const answerEl = $('answer') as HTMLTextAreaElement
const outputEl = $('output') as HTMLDivElement
const hintEl = $('hint') as HTMLDivElement
const apiStatusEl = document.getElementById('apiStatus') as HTMLDivElement | null
const histListEl = document.getElementById('histList') as HTMLDivElement
const histSearchEl = document.getElementById('histSearch') as HTMLInputElement
const histSortEl = document.getElementById('histSort') as HTMLSelectElement
const histClearAllEl = document.getElementById('histClearAll') as HTMLButtonElement

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function questionSummary(q: string, max = 32) {
  const t = (q || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

let history: HistoryItem[] = []
let activeHistoryId: string | null = null

function badgeClass(level: string) {
  return level === '优秀' ? 'badge good' : level === '合格' ? 'badge ok' : 'badge bad'
}

function renderHistory() {
  const q = histSearchEl.value.trim().toLowerCase()
  const sort = histSortEl.value

  let items = [...history]
  if (q) {
    items = items.filter((x) => `${x.role}\n${x.question}`.toLowerCase().includes(q))
  }
  if (sort === 'scoreDesc') items.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
  if (sort === 'scoreAsc') items.sort((a, b) => a.score - b.score || b.createdAt - a.createdAt)
  if (sort === 'recent') items.sort((a, b) => b.createdAt - a.createdAt)

  if (!items.length) {
    histListEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-title">暂无历史记录</div>
        <div class="history-empty-sub">生成一次复盘后将自动保存到这里</div>
      </div>
    `
    return
  }

  histListEl.innerHTML = items
    .map((x) => {
      const active = x.id === activeHistoryId ? 'active' : ''
      return `
        <div class="history-item ${active}" data-id="${escapeHtml(x.id)}" role="button" tabindex="0">
          <div class="history-row">
            <div class="history-main">
              <div class="history-role">${escapeHtml(x.role || '（未命名岗位）')}</div>
              <div class="history-question">${escapeHtml(questionSummary(x.question))}</div>
            </div>
            <div class="history-side">
              <div class="history-score ${badgeClass(x.level)}">${x.score}</div>
              <div class="history-time">
                <svg class="icon"><use href="#i-clock"></use></svg>
                ${escapeHtml(formatTime(x.createdAt))}
              </div>
            </div>
          </div>
          <div class="history-item-actions">
            <button class="btn btn-ghost btn-small hist-open" type="button">打开</button>
            <button class="btn btn-ghost btn-small hist-del" type="button" title="删除">
              <svg class="btn-icon"><use href="#i-trash"></use></svg>
            </button>
          </div>
        </div>
      `
    })
    .join('')

  // bind
  histListEl.querySelectorAll<HTMLElement>('.history-item').forEach((el) => {
    const id = el.dataset.id || ''
    const open = () => openHistory(id)
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.hist-del') || target.closest('.hist-open')) return
      open()
    })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open()
    })
  })
  histListEl.querySelectorAll<HTMLButtonElement>('.hist-open').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.history-item') as HTMLElement | null
      const id = item?.dataset.id
      if (id) openHistory(id)
    })
  })
  histListEl.querySelectorAll<HTMLButtonElement>('.hist-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.history-item') as HTMLElement | null
      const id = item?.dataset.id
      if (!id) return
      if (!confirm('确认删除这条历史记录？')) return
      history = removeHistory(id)
      if (activeHistoryId === id) activeHistoryId = null
      renderHistory()
      hint('已删除')
    })
  })
}

function openHistory(id: string) {
  const item = history.find((x) => x.id === id)
  if (!item) return
  activeHistoryId = id
  roleEl.value = item.role
  questionEl.value = item.question
  answerEl.value = item.answer
  renderResult(item.result)
  renderHistory()
  hint('已从历史记录打开')
}

function renderResult(res: ReviewResult) {
  const badgeClass = res.level === '优秀' ? 'badge good' : res.level === '合格' ? 'badge ok' : 'badge bad'

  const renderRetrieval = (hits?: RetrievalHit[]) => {
    if (!hits || !hits.length) return ''
    return `
      <div class="section">
        <div class="section-title">
          <span class="section-title-inline">
            <svg class="icon"><use href="#i-book"></use></svg>
            参考示例（RAG）
          </span>
          <span class="section-subtitle">本次生成参考了以下高质量示例模板（仅作结构与表达参考）</span>
        </div>
        <div class="retrieval">
          ${hits
            .map((h) => {
              const chips: string[] = []
              if (h.seniority) chips.push(h.seniority)
              if (h.difficulty) chips.push(h.difficulty)
              if (h.group) chips.push(h.group)
              if (h.type) chips.push(h.type)
              if (Array.isArray(h.tags)) chips.push(...h.tags)
              const showChips = chips.slice(0, 6)
              return `
                <div class="retrieval-item">
                  <div class="retrieval-q">${escapeHtml(h.question)}</div>
                  <div class="retrieval-meta">
                    ${showChips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}
                    <span class="chip chip-weak">score ${Math.round(h.score)}</span>
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      </div>
    `
  }

  outputEl.classList.remove('empty')
  outputEl.innerHTML = `
    <div class="result-head">
      <div class="score">
        <div class="score-num">${res.score}</div>
        <div class="score-text">综合评分</div>
      </div>
      <div class="${badgeClass}">${res.level}</div>
      <div class="summary">${escapeHtml(res.summary)}</div>
    </div>

    <div class="section">
      <div class="section-title">维度评分</div>
      <div class="rubric">
        ${res.rubric
          .map(
            (r) => `
              <div class="rubric-item">
                <div class="rubric-top">
                  <div class="rubric-dim">${escapeHtml(r.dimension)}</div>
                  <div class="rubric-score">${r.score}/10</div>
                </div>
                <div class="rubric-comment">${escapeHtml(r.comment)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>

    ${renderRetrieval(res.retrieval)}

    <div class="two-col">
      <div class="section">
        <div class="section-title">答得好的点</div>
        <ul class="list">
          ${res.highlights.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>

      <div class="section">
        <div class="section-title">主要问题与怎么改</div>
        <div class="problems">
          ${res.problems
            .map(
              (p) => `
                <div class="problem">
                  <div class="problem-title">${escapeHtml(p.title)}</div>
                  <div class="problem-detail">${escapeHtml(p.detail)}</div>
                  <div class="problem-fix"><span>改法：</span>${escapeHtml(p.fix)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">改写示例（可直接口述）</div>
      <div class="copy-row">
        <button id="btnCopyBetter" class="btn btn-small" type="button">
          <svg class="btn-icon"><use href="#i-copy"></use></svg>
          复制
        </button>
      </div>
      <pre class="pre"><code>${escapeHtml(res.betterAnswer)}</code></pre>
    </div>

    <div class="section">
      <div class="section-title">面试官下一轮最可能追问</div>
      <div class="copy-row">
        <button id="btnCopyFU" class="btn btn-small" type="button">
          <svg class="btn-icon"><use href="#i-copy"></use></svg>
          复制
        </button>
      </div>
      <ol class="olist">
        ${res.followUps.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
      </ol>
    </div>
  `

  // bind copy
  const btnBetter = document.getElementById('btnCopyBetter') as HTMLButtonElement | null
  btnBetter?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(res.betterAnswer)
    hint('已复制改写示例')
  })

  const btnFU = document.getElementById('btnCopyFU') as HTMLButtonElement | null
  btnFU?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(res.followUps.map((x, i) => `${i + 1}. ${x}`).join('\n'))
    hint('已复制追问问题')
  })
}

function renderError(title: string, detail?: string) {
  outputEl.classList.remove('empty')
  outputEl.innerHTML = `
    <div class="error-box">
      <div class="error-title">
        <svg class="icon"><use href="#i-alert"></use></svg>
        ${escapeHtml(title)}
      </div>
      ${detail ? `<div class="error-detail">${escapeHtml(detail)}</div>` : ''}
      <div class="error-actions">
        <button id="btnRetry" class="btn btn-small" type="button">重试</button>
        <button id="btnCheckApi" class="btn btn-small" type="button">检测 API</button>
      </div>
      <div class="error-hint">常见原因：后端没启动 / .env 没写 DASHSCOPE_API_KEY / Key 无效或没额度 / 网络问题。</div>
    </div>
  `

  document.getElementById('btnRetry')?.addEventListener('click', () => btnAnalyze.click())
  document.getElementById('btnCheckApi')?.addEventListener('click', () => void checkApi())
}

function hint(msg: string) {
  hintEl.textContent = msg
  hintEl.classList.add('show')
  window.clearTimeout((hint as any)._t)
  ;(hint as any)._t = window.setTimeout(() => hintEl.classList.remove('show'), 1600)
}

const btnAnalyze = $<HTMLButtonElement>('btnAnalyze')
let aborter: AbortController | null = null

function renderStreaming(initial?: { retrieval?: RetrievalHit[] }) {
  outputEl.classList.remove('empty')
  outputEl.innerHTML = `
    <div class="stream">
      <div class="stream-head">
        <div class="stream-title">生成中</div>
        <div class="stream-actions">
          <button id="btnCancel" class="btn btn-ghost btn-small" type="button">
            <svg class="btn-icon"><use href="#i-eraser"></use></svg>
            取消
          </button>
        </div>
      </div>
      <div class="stream-sub">系统正在逐步生成内容；完成后会自动渲染结构化结果。</div>
      <div id="streamRetrieval"></div>
      <pre class="stream-box" id="streamBox"></pre>
    </div>
  `

  document.getElementById('btnCancel')?.addEventListener('click', () => {
    aborter?.abort()
  })

  if (initial?.retrieval?.length) {
    const container = document.getElementById('streamRetrieval')
    if (container) {
      container.innerHTML = `
        <div class="section" style="margin-top:14px">
          <div class="section-title">
            <span class="section-title-inline">
              <svg class="icon"><use href="#i-book"></use></svg>
              参考示例（RAG）
            </span>
            <span class="section-subtitle">本次生成参考了以下高质量示例模板（仅作结构与表达参考）</span>
          </div>
          <div class="retrieval">
            ${initial.retrieval
              .map((h) => {
                const chips: string[] = []
                if (h.seniority) chips.push(h.seniority)
                if (h.difficulty) chips.push(h.difficulty)
                if (h.group) chips.push(h.group)
                if (h.type) chips.push(h.type)
                if (Array.isArray(h.tags)) chips.push(...h.tags)
                const showChips = chips.slice(0, 6)
                return `
                  <div class="retrieval-item">
                    <div class="retrieval-q">${escapeHtml(h.question)}</div>
                    <div class="retrieval-meta">
                      ${showChips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}
                      <span class="chip chip-weak">score ${Math.round(h.score)}</span>
                    </div>
                  </div>
                `
              })
              .join('')}
          </div>
        </div>
      `
    }
  }
}

function appendStreaming(text: string) {
  const box = document.getElementById('streamBox')
  if (!box) return
  box.textContent = (box.textContent || '') + text
  box.scrollTop = box.scrollHeight
}

btnAnalyze.addEventListener('click', async () => {
  const role = roleEl.value.trim()
  const question = questionEl.value.trim()
  const answer = answerEl.value.trim()

  if (!role || !question || !answer) {
    hint('请先填写岗位 / 面试题 / 回答')
    return
  }

  aborter?.abort()
  aborter = new AbortController()

  btnAnalyze.disabled = true
  btnAnalyze.textContent = '生成中...'
  try {
    renderStreaming()
    const res: ReviewResult = await analyzeAnswerStream(
      { role, question, answer },
      {
        signal: aborter.signal,
        onMeta: (retrieval) => renderStreaming({ retrieval }),
        onChunk: (t) => appendStreaming(t),
      },
    )
    renderResult(res)

    // 自动保存历史
    const item: HistoryItem = {
      id: newId(),
      createdAt: Date.now(),
      role,
      question,
      answer,
      score: res.score,
      level: res.level,
      result: res,
    }
    history = addHistory(item)
    activeHistoryId = item.id
    renderHistory()
    hint('已生成并保存到历史')
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? '已取消生成' : e?.message || '请检查 Key/网络'
    hint(`生成失败：${msg}`)
    renderError('生成复盘失败', msg)
  } finally {
    btnAnalyze.disabled = false
    btnAnalyze.textContent = '生成复盘'
    aborter = null
  }
})

$<HTMLButtonElement>('btnClear').addEventListener('click', () => {
  roleEl.value = ''
  questionEl.value = ''
  answerEl.value = ''
  outputEl.classList.add('empty')
  outputEl.innerHTML = `
    <div class="empty-title">等待输入</div>
    <div class="empty-subtitle">填写上方内容后点击「生成复盘」</div>
  `
  hint('已清空')
})

$<HTMLButtonElement>('btnFill').addEventListener('click', () => {
  roleEl.value = '后端开发（Java / 微服务）'
  questionEl.value = '讲讲你做过一次线上故障处理的经历：你是怎么定位、怎么止损、怎么复盘的？'
  answerEl.value =
    '有一次我们线上接口突然大量超时，我先看了监控发现QPS其实没涨但是RT飙升，然后去查日志发现有很多慢SQL。我就把那个SQL加了索引，另外把一个耗时的逻辑做了缓存，之后就好了。后面也做了一些优化。'
  hint('已填充示例，可直接点击生成复盘')
})

histSearchEl.addEventListener('input', () => renderHistory())
histSortEl.addEventListener('change', () => renderHistory())
histClearAllEl.addEventListener('click', () => {
  if (!confirm('确认清空全部历史记录？此操作不可撤销。')) return
  history = clearHistory()
  activeHistoryId = null
  renderHistory()
  hint('已清空历史记录')
})

async function checkApi() {
  if (!apiStatusEl) return
  try {
    const resp = await fetch('/api/health')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    const keyOk = data?.keyPresent ? 'Key✓' : 'Key×'
    apiStatusEl.textContent = `API: OK（${keyOk}，model=${data?.model || '-'}）`
    apiStatusEl.classList.add('ok')
    apiStatusEl.classList.remove('bad')
  } catch (e: any) {
    apiStatusEl.textContent = `API: 不可用（${e?.message || '连接失败'}）`
    apiStatusEl.classList.add('bad')
    apiStatusEl.classList.remove('ok')
  }
}

void checkApi()

// init history
history = loadHistory()
renderHistory()
