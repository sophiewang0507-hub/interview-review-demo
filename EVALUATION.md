# 评测方法 + 数据导出 + 指标统计（用于简历量化）

本项目已实现“历史记录（localStorage）+ RAG 命中（retrieval）”。你可以用下面方式快速产出：
- 一份可复用的评测方法（人工打分口径）
- 从浏览器导出历史记录 JSON
- 用脚本生成统计指标与“简历可用数字口径”

---

## 1. 评测目标（你要量化什么）

建议把评测拆成两层：

### 1.1 系统硬指标（可自动统计）
- **结构化输出合规率**：输出 JSON 字段齐全、类型正确的比例
- **RAG 命中率**：结果中包含 `retrieval` 且命中数量 > 0 的比例
- **结果稳定性（可选）**：同一输入多次生成，结构是否稳定（字段齐全、段落结构一致）

### 1.2 内容质量（需要人工标注）
重点评估 `betterAnswer`（改写示例）是否“像真实面试里能说出口的答案”，并且不编造。

推荐 4 个维度（每维 1-5 分）：
1) **结构清晰（STAR/结论先行）**：是否有结论、背景、行动、结果、复盘，层次是否清楚  
2) **可验证性**：是否给出验证思路/证据线索（监控、对照、压测、指标口径等），缺信息是否用【占位符】提示补齐  
3) **岗位贴合度**：是否对齐岗位能力（后端：稳定性/取舍/回滚；前端：性能/工程化；PM：指标/推进；DA：口径/拆解；AI：实验/上线闭环等）  
4) **表达可信度**：是否避免空话套话、避免编造；是否能明确“我负责的部分”

可加 1 个扣分项（0/1）：
- **是否疑似编造关键事实**（公司名、业务规模、明确数值等不在用户输入中却凭空出现）

#### 人工标注建议
- 样本量：**20-50 条**即可形成可写简历的结果  
- 标注者：至少 1 人（最好 2 人做交叉验证，取平均分）  
- 输出：每条记录附加 `humanScore`（四维均分）与 `hallucinationFlag`（0/1）

---

## 2. 从浏览器导出 localStorage 历史记录（JSON）

> 历史记录 key：`interview_review_history_v1`

### 方法 A：控制台一键导出（推荐）
1) 打开 Demo 页面（例如 http://localhost:5173/）  
2) 按 F12 打开 DevTools → Console  
3) 粘贴运行下面脚本，会自动下载一个 `interview_review_history_YYYYMMDD_HHMMSS.json`：

```js
(() => {
  const KEY = 'interview_review_history_v1';
  const raw = localStorage.getItem(KEY) || '[]';
  let data = [];
  try { data = JSON.parse(raw); } catch (e) { console.error('JSON parse failed', e); }
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `interview_review_history_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  console.log('Exported:', name, 'items=', Array.isArray(data) ? data.length : 0);
})();
```

### 方法 B：手动复制
在 Console 执行：
```js
copy(localStorage.getItem('interview_review_history_v1'))
```
再粘贴到一个 `.json` 文件里保存。

---

## 3. 用脚本生成统计指标与“简历可用”口径

脚本位置：`tools/history_stats.py`

### 3.1 生成统计报告（Markdown）
```bash
python tools/history_stats.py path\to\interview_review_history_xxx.json --out metrics.md
```

输出内容包括：
- 样本数、时间范围
- 分数均值/中位数/P90
- 等级分布（优秀/合格/需改进）
- RAG 命中率、Top 命中示例（按 group/type 聚合）
- 自动生成“简历可用数字口径”模板（你只需替换/确认数字）

### 3.2（可选）加入人工标注分数
如果你想把人工标注也汇总进报告：
- 在导出的 JSON 里为每条 item 增加字段：
  - `humanScore`：0-5（四维均分）
  - `hallucinationFlag`：0/1
- 再运行脚本，它会自动统计平均 `humanScore`、编造率等指标。

