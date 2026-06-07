import argparse
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def safe_load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        # 兼容 Windows 记事本可能保存为 utf-8-sig
        return json.loads(path.read_text(encoding="utf-8-sig"))


def pct(n, d):
    if d <= 0:
        return "0.0%"
    return f"{(n / d) * 100:.1f}%"


def fmt_dt(ts_ms: int):
    try:
        return datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "-"


def quantile(xs, q):
    if not xs:
        return None
    xs2 = sorted(xs)
    # nearest-rank
    k = int(math.ceil(q * len(xs2))) - 1
    k = max(0, min(len(xs2) - 1, k))
    return xs2[k]


def shorten(s, n=40):
    s = " ".join((s or "").split())
    return s if len(s) <= n else (s[:n] + "…")


def main():
    ap = argparse.ArgumentParser(description="Analyze interview_review_history export")
    ap.add_argument("input", help="导出的 history json 文件路径（来自 localStorage）")
    ap.add_argument("--out", help="输出 Markdown 文件路径（可选）")
    args = ap.parse_args()

    path = Path(args.input).expanduser().resolve()
    data = safe_load_json(path)
    if not isinstance(data, list):
        raise SystemExit("输入 JSON 不是数组，请确认导出文件正确。")

    n = len(data)
    created = [int(x.get("createdAt", 0) or 0) for x in data if isinstance(x, dict)]
    created = [x for x in created if x > 0]
    created_min = min(created) if created else None
    created_max = max(created) if created else None

    scores = []
    levels = Counter()
    roles = Counter()
    qtypes = Counter()
    rag_hit = 0
    rag_total = 0
    ex_by_id = Counter()
    ex_by_group = Counter()
    ex_by_type = Counter()
    ex_by_seniority = Counter()
    ex_by_difficulty = Counter()
    missing_fields = 0

    human_scores = []
    halluc_flags = []

    for x in data:
        if not isinstance(x, dict):
            continue

        role = str(x.get("role", "") or "").strip()
        question = str(x.get("question", "") or "").strip()
        score = x.get("score", None)
        level = str(x.get("level", "") or "").strip()
        result = x.get("result", {}) if isinstance(x.get("result", {}), dict) else {}

        # 基本字段检查（用于“结构化合规率”近似）
        if not role or not question or not isinstance(result, dict):
            missing_fields += 1

        if isinstance(score, (int, float)):
            scores.append(float(score))
        elif isinstance(result.get("score"), (int, float)):
            scores.append(float(result.get("score")))

        if not level and isinstance(result.get("level"), str):
            level = result.get("level")
        if level:
            levels[level] += 1

        if role:
            roles[role] += 1

        # 简易题型识别（用于“题型×岗位”分布观测）
        q_lower = question.lower()
        qt = None
        if any(k in q_lower for k in ["系统设计", "架构", "设计一个", "design"]):
            qt = "系统设计"
        elif any(k in q_lower for k in ["故障", "线上", "事故", "白屏", "排查", "止损", "incident"]):
            qt = "故障处理"
        elif any(k in q_lower for k in ["性能", "慢", "优化", "p95", "lcp", "tti", "profil"]):
            qt = "性能优化"
        elif any(k in q_lower for k in ["优先级", "需求", "指标", "ab", "实验", "增长", "漏斗", "rice"]):
            qt = "产品/数据方法"
        elif any(k in q_lower for k in ["推荐", "模型", "训练", "部署", "rag", "prompt"]):
            qt = "算法/AI"
        else:
            qt = "通用"
        qtypes[qt] += 1

        # RAG 命中统计（从 result.retrieval）
        retrieval = result.get("retrieval")
        if isinstance(retrieval, list):
            rag_total += 1
            if len(retrieval) > 0:
                rag_hit += 1
            for r in retrieval:
                if not isinstance(r, dict):
                    continue
                ex_id = str(r.get("id", "") or "").strip()
                if ex_id:
                    ex_by_id[ex_id] += 1
                g = str(r.get("group", "") or "").strip()
                t = str(r.get("type", "") or "").strip()
                s = str(r.get("seniority", "") or "").strip()
                dff = str(r.get("difficulty", "") or "").strip()
                if g:
                    ex_by_group[g] += 1
                if t:
                    ex_by_type[t] += 1
                if s:
                    ex_by_seniority[s] += 1
                if dff:
                    ex_by_difficulty[dff] += 1

        # 可选人工标注字段
        if isinstance(x.get("humanScore"), (int, float)):
            human_scores.append(float(x["humanScore"]))
        if isinstance(x.get("hallucinationFlag"), (int, float)):
            halluc_flags.append(int(x["hallucinationFlag"]))

    scores_sorted = sorted(scores)
    avg = statistics.mean(scores_sorted) if scores_sorted else None
    med = statistics.median(scores_sorted) if scores_sorted else None
    p90 = quantile(scores_sorted, 0.90)
    p10 = quantile(scores_sorted, 0.10)

    structured_ok = n - missing_fields
    structured_rate = pct(structured_ok, n)

    rag_rate = pct(rag_hit, rag_total) if rag_total else "0.0%"

    def top_k(counter: Counter, k=5):
        return counter.most_common(k)

    lines = []
    lines.append("# 评测统计报告（自动生成）")
    lines.append("")
    lines.append("## 概览")
    lines.append(f"- 样本数：**{n}**")
    if created_min and created_max:
        lines.append(f"- 时间范围：{fmt_dt(created_min)} ～ {fmt_dt(created_max)}")
    lines.append(f"- 结构化输出合规率（近似）：**{structured_rate}**（缺失关键字段 {missing_fields} 条）")
    lines.append(f"- RAG 命中率：**{rag_rate}**（有 retrieval 字段 {rag_total} 条，其中命中>0 为 {rag_hit} 条）")
    lines.append("")

    lines.append("## 分数分布")
    if scores_sorted:
        lines.append(f"- 平均分：**{avg:.1f}**")
        lines.append(f"- 中位数：**{med:.1f}**")
        lines.append(f"- P10 / P90：**{p10:.0f} / {p90:.0f}**")
    else:
        lines.append("- 未发现 score 字段")
    lines.append("")

    lines.append("## 等级分布（level）")
    if levels:
        for k, v in levels.most_common():
            lines.append(f"- {k}：{v}（{pct(v, n)}）")
    else:
        lines.append("- 未发现 level 字段")
    lines.append("")

    lines.append("## 题型粗分布（基于题目关键词的启发式）")
    for k, v in qtypes.most_common():
        lines.append(f"- {k}：{v}（{pct(v, n)}）")
    lines.append("")

    lines.append("## Top 角色（role）")
    for k, v in top_k(roles, 8):
        lines.append(f"- {shorten(k, 28)}：{v}")
    lines.append("")

    if ex_by_id:
        lines.append("## Top 命中示例（retrieval.id）")
        for k, v in top_k(ex_by_id, 10):
            lines.append(f"- {k}：{v}")
        lines.append("")

    if ex_by_group:
        lines.append("## 命中示例分布（group/type/seniority/difficulty）")
        lines.append("**group**：")
        for k, v in top_k(ex_by_group, 8):
            lines.append(f"- {k}：{v}")
        lines.append("")
        lines.append("**type**：")
        for k, v in top_k(ex_by_type, 10):
            lines.append(f"- {k}：{v}")
        lines.append("")
        if ex_by_seniority:
            lines.append("**seniority**：")
            for k, v in top_k(ex_by_seniority, 10):
                lines.append(f"- {k}：{v}")
            lines.append("")
        if ex_by_difficulty:
            lines.append("**difficulty**：")
            for k, v in top_k(ex_by_difficulty, 10):
                lines.append(f"- {k}：{v}")
            lines.append("")

    if human_scores:
        lines.append("## 人工标注（可选字段）")
        lines.append(f"- humanScore 平均：**{statistics.mean(human_scores):.2f}/5**（样本 {len(human_scores)}）")
        if halluc_flags:
            lines.append(
                f"- hallucinationFlag（疑似编造率）：**{pct(sum(halluc_flags), len(halluc_flags))}**（样本 {len(halluc_flags)}）"
            )
        lines.append("")

    # 简历口径模板
    lines.append("## 简历可用数字口径（可直接复制/微调）")
    lines.append("- 在【X 天】内从 0→1 交付 AI 面试复盘 MVP，覆盖“输入→复盘→改写→追问→历史复用”闭环。")
    lines.append(f"- 基于历史样本（n={n}）统计：平均评分 **{avg:.1f}**、P90 **{p90:.0f}**；等级分布："
                 + "、".join([f"{k}{v}条" for k, v in levels.most_common()][:3]) + "。"
                 if scores_sorted and levels else
                 f"- 基于历史样本（n={n}）统计：已沉淀结构化复盘记录并支持检索/排序/复用。")
    lines.append(f"- 引入示例库 RAG 后，RAG 命中率达 **{rag_rate}**，并在前端展示“参考示例”提升可解释性。")
    lines.append("-（可选）构建 20-50 条评测集，按“结构清晰/可验证/岗位匹配/可信度”四维 1-5 分人工打分，输出 humanScore 与疑似编造率，用于量化内容质量提升。")
    lines.append("")

    report = "\n".join(lines).strip() + "\n"

    if args.out:
        out = Path(args.out).expanduser().resolve()
        out.write_text(report, encoding="utf-8")
        print(f"已生成：{out}")
    else:
        print(report)


if __name__ == "__main__":
    main()

