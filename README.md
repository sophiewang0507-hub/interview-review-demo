# AI 面试复盘助手（Demo）

一个可交互的前端 Demo：输入 **目标岗位 / 面试题 / 你的回答**，点击按钮后输出：
- 评分 + 等级
- 答得好的点、主要问题与改进建议
- 改写示例（可直接口述）
- 面试官下一轮最可能追问的问题

> 说明：当前已接入 **阿里百炼（DashScope，OpenAI 兼容模式）**（通过本地后端代理调用），不会把 Key 暴露在浏览器里。
>
> 另外：已加入一个“示例库 RAG（关键词检索版）”——后端会从 `server/knowledge/examples_seed.json` 的 **“题型×岗位”矩阵示例**中检索最相似的高质量模板（运行时扩展为 60 条：校招/社招/专家），并注入到 prompt，提升改写示例的真实性与颗粒度。
> 前端输出区域会展示“参考示例（RAG）”，用于解释本次生成参考了哪些示例模板。

## 本地启动

1) 在项目根目录创建 `.env`（参考 `.env.example`）：

```bash
DASHSCOPE_API_KEY=你的key
# DashScope OpenAI 兼容模式 base_url（一般不用改）
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# 模型名按需修改
DASHSCOPE_MODEL=qwen3.7-max
# 是否开启深度思考（可选）
DASHSCOPE_ENABLE_THINKING=false
```

2) 安装依赖并启动（同时启动前端 + 后端）：

```bash
npm install
npm run dev
```

启动后打开终端提示的本地地址即可。

## 关键文件

- `src/main.ts`：页面与交互逻辑（表单、点击、渲染结果、复制按钮等）
- `src/analyze.ts`：前端调用后端 `/api/analyze`，并做结果归一化
- `server/index.ts`：后端代理（读取 `DASHSCOPE_API_KEY` 调用阿里百炼，并返回结构化 JSON）
- `server/knowledge/examples_seed.json`：示例库 seed（题型×岗位矩阵，运行时扩展为 60 条，含 difficulty/seniority）
- `server/rag.ts`：检索逻辑（关键词打分 TopK）与 RAG 上下文拼装
- `EVALUATION.md`：评测方法 + 导出 localStorage + 生成简历量化口径
- `tools/history_stats.py`：读取导出的 history JSON 生成统计报告（Markdown）
