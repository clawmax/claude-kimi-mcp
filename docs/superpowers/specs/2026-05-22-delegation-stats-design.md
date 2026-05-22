# Delegation Stats 设计文档

**日期**：2026-05-22  
**目标**：让用户直观看到 claude-kimi-mcp 发挥了多大价值（以费用节省为核心指标）

---

## 背景与动机

claude-kimi-mcp 的价值主张是：将编码任务委派给 Kimi K2.6（更低成本），由 Claude 负责架构决策和结果 review。但用户目前对"节省了多少"没有感知。本功能在每次任务完成后展示一段 session 级别的对比统计，让用户看到具体的费用节省数字。

---

## 展示格式

每次工具（`implement_feature` / `write_tests` / `fix_bug`）调用完成后，在 Completion Report 末尾追加：

```
━━━ Delegation Stats (session) ━━━━━━━━━━━━━━━━━━━━━
  Kimi   3 tasks   48,230 in / 4,120 out   ~$0.007
  Claude            45,200 in / 8,900 out   ~$0.270
  ─────────────────────────────────────────────────
  Kimi handled 52% of input traffic
  Estimated savings vs all-Claude: ~$0.26
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**展示逻辑：**
- Kimi 行：当前 session 内所有已完成任务的 token 累计（内存，进程级）
- Claude 行：读取当前 session 的 `.jsonl` 文件中所有 assistant 消息的 usage 汇总
- savings = 把 Kimi 消耗的 token 量，按 Claude 定价计算的费用 − 实际 Kimi 费用
- 百分比 = Kimi input / (Kimi input + Claude input)

---

## 数据来源

### Kimi 侧

`agent-loop.ts` 的 while 循环每步调用 Kimi API 后读取 `response.usage`：

```typescript
kimiInputTokens  += response.usage?.prompt_tokens ?? 0
kimiOutputTokens += response.usage?.completion_tokens ?? 0
```

累加结果通过 `AgentResult.tokens` 返回给 `index.ts`。

`index.ts` 维护模块级变量：

```typescript
const kimiSessionStats = { input: 0, output: 0, tasks: 0 };
```

每次工具调用结束后累加，进程生命周期 = Claude Code session 生命周期，无需持久化。

### Claude 侧

Claude Code 将每次 API 响应写入：

```
~/.claude/projects/<encoded-repo-path>/<session-id>.jsonl
```

路径编码规则：`repo_path` 的首字符 `/` 去掉，其余 `/` 替换为 `-`。  
例：`/Users/foo/myproject` → `-Users-foo-myproject`

读取逻辑：
1. 找到该目录下最近修改的 `.jsonl` 文件（即当前 session）
2. 逐行解析，筛选 `type === "assistant"` 的条目
3. 汇总 `message.usage` 中的：
   - 输入 = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
   - 输出 = `output_tokens`
4. 文件不存在或解析失败 → 返回 `null`，静默降级（不展示 Claude 行，不抛错）

---

## 费用计算

### 默认定价（可通过环境变量覆盖）

| 参数 | 默认值 | 说明 |
|---|---|---|
| `KIMI_INPUT_PRICE_PER_M` | `0.15` | Kimi 输入 USD/百万 token |
| `KIMI_OUTPUT_PRICE_PER_M` | `0.15` | Kimi 输出 USD/百万 token |
| `CLAUDE_INPUT_PRICE_PER_M` | `3.0` | Claude 输入 USD/百万 token |
| `CLAUDE_OUTPUT_PRICE_PER_M` | `15.0` | Claude 输出 USD/百万 token |

### 计算公式

```
kimiCost    = (kimiInput * KIMI_INPUT_PRICE + kimiOutput * KIMI_OUTPUT_PRICE) / 1_000_000
claudeCost  = (claudeInput * CLAUDE_INPUT_PRICE + claudeOutput * CLAUDE_OUTPUT_PRICE) / 1_000_000
savings     = (kimiInput * CLAUDE_INPUT_PRICE + kimiOutput * CLAUDE_OUTPUT_PRICE) / 1_000_000 - kimiCost
kimiShare   = kimiInput / (kimiInput + claudeInput)  // 仅对 input 计算占比
```

费用格式：小于 $0.001 显示 `<$0.001`，否则保留两位小数。

---

## 开关控制

环境变量 `KIMI_SHOW_TOKEN_STATS`：
- 未设置或非 `"false"` → 展示统计（默认开启）
- `"false"` → 不追加统计块，其余输出不受影响

---

## 文件结构变更

```
src/
  agent-loop.ts       修改：累加 Kimi token，AgentResult 新增 tokens 字段
  claude-usage.ts     新建：读取 Claude session .jsonl，返回 usage 汇总
  stats-reporter.ts   新建：接收双侧数据，计算费用/占比，格式化输出字符串
  index.ts            修改：模块级 kimiSessionStats；工具调用后组合展示
```

---

## 边界处理

| 场景 | 处理方式 |
|---|---|
| Claude session 文件读取失败 | 只展示 Kimi 行，Claude 行缺省，不抛错 |
| Kimi 调用 fallback_needed | 依然累计本次消耗的 token（失败也烧了钱） |
| 首次任务（Kimi tasks=1） | 正常展示，无特殊处理 |
| 定价环境变量格式非法 | 静默回退到默认值 |
| token 数为 0（API 未返回 usage） | 展示 0，不隐藏 |

---

## 不在本次范围内

- 持久化跨 session 的历史统计
- 在 Claude Code 的 `/usage` 命令里集成
- 自动更新定价（需用户手动维护环境变量）
