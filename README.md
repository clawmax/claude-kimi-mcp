# claude-kimi-mcp

**English** | [中文](#中文文档)

---

## What Is This?

`claude-kimi-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for **Claude Code** that silently delegates coding tasks to **Kimi K2.6** — Moonshot AI's state-of-the-art coding agent — running on an isolated Git branch.

You talk to Claude naturally. Claude decides when to delegate. Kimi implements. Claude reviews and reports back. **You never need to know Kimi is involved.**

**Result: 60–70% lower AI cost. Same output quality. Fully transparent to the user.**

---

## Why claude-kimi-mcp?

### The Problem: Claude Code Is Powerful But Expensive

Claude Code (powered by Claude Sonnet/Opus) is one of the most capable AI coding assistants available. But if you use it for everything — from high-level design down to boilerplate implementation — you're paying premium token prices for work that doesn't require premium reasoning.

A typical software feature breaks down like this:

| Task | Token Share | Requires Claude? |
|------|------------|-----------------|
| Architecture design, API contracts | ~10% | Yes — complex reasoning |
| Task decomposition, spec writing | ~10% | Yes — judgment + context |
| Code implementation, boilerplate | ~50% | No — mechanical, rule-based |
| Test writing | ~15% | No — pattern-matching |
| Bug fixing iteration | ~15% | No — systematic debugging |

**75% of your tokens go to tasks that a cheaper, specialized model handles just as well.**

### The Solution: Transparent Auto-Delegation

Once installed, `claude-kimi-mcp` changes nothing about how you interact with Claude Code. You keep working exactly as before — Claude automatically routes implementation work to Kimi K2.6 in the background, reviews the result, and presents it to you as its own.

```
You ──────────────────────────────────────────────────────────► You
     "add JWT auth to my API"                    "done, here's what changed"
              │                                           ▲
              ▼                                           │
        Claude Code (architect + reviewer)               │
              │ auto-invokes delegation tool             │
              ▼                                           │
        Kimi K2.6 Agent  ◄──► feature branch            │
              │  reads files, writes code, runs tests    │
              │  self-corrects on errors (up to 300 steps)│
              └──────────────── diff ────────────────────┘
```

If the first delegation attempt produces a poor result, Claude automatically retries. If the second attempt also fails, Claude falls back to handling the task directly — silently, without any user action required.

### Why Kimi K2.6 Specifically?

- **Purpose-built for agentic coding**: 300-step tool-calling loop, self-correction, multi-file edits
- **256K context window**: can load entire codebases without chunking
- **OpenAI-compatible API**: drop-in integration, no custom client needed
- **SOTA on coding benchmarks**: competes with GPT-4o on SWE-bench, HumanEval, and LiveCodeBench
- **Significantly cheaper** than Claude Sonnet/Opus for equivalent coding tasks

### Why Git Branch Isolation?

Kimi works entirely on a named feature branch — never on `main`, `master`, or any protected branch. Claude controls the merge decision. This means:

- Kimi's changes are always reviewable before they touch production code
- Bad outputs are one `git branch -D` away from disappearing
- The review step forces a natural quality gate
- Supports any default branch name: `main`, `master`, `develop`, `trunk`

---

## Quick Start

### Prerequisites

- Node.js >= 18
- Claude Code CLI (`claude` in PATH)
- Kimi API Key — get one at [platform.moonshot.cn](https://platform.moonshot.cn) (or [platform.moonshot.ai](https://platform.moonshot.ai) outside China)

---

### Method 1 — npx (zero install, try it now)

No installation required. The MCP server runs directly via npx.

**Step 1** — Register with Claude Code:

```bash
claude mcp add -s user kimi-agent --env KIMI_API_KEY=sk-your-key -- npx -y claude-kimi-mcp
```

Replace `sk-your-key` with your actual Kimi API key. For international users, also add `--env KIMI_BASE_URL=https://api.moonshot.ai/v1`.

**Step 2** — Enable auto-delegation (add to `~/.claude/CLAUDE.md`):

```markdown
## Auto-Delegation Rules (claude-kimi-mcp)

When the MCP tools `implement_feature`, `write_tests`, and `fix_bug` are available:
- For any implementation, test-writing, or bug-fix task, call these tools first instead of writing code directly.
- If the first result is unsatisfactory, retry once with `attempt: 2`.
- If `fallback_needed: true` is returned, handle the task directly without mentioning it.
- Never mention delegation to the user — present all results as your own work.
```

**Restart Claude Code.** Done.

**Updating:** npx always fetches the latest version automatically — just restart Claude Code.

---

### Method 2 — Global install + setup wizard (recommended)

**Step 1** — Install:

```bash
npm install -g claude-kimi-mcp
```

**Step 2** — Run the setup wizard (handles everything automatically):

```bash
claude-kimi-mcp setup
```

The wizard will ask for your API key, region, and scope, register the MCP server with Claude Code, and optionally add the auto-delegation rules to `~/.claude/CLAUDE.md`.

**Restart Claude Code.** Done.

**Updating:**

```bash
npm update -g claude-kimi-mcp
# Then restart Claude Code
```

---

### Method 3 — Source install (for contributors / custom builds)

```bash
git clone https://github.com/clawmax/claude-kimi-mcp.git
cd claude-kimi-mcp
npm install          # auto-builds TypeScript via prepare script
node dist/cli.js setup
```

**Updating:**

```bash
git pull && npm install
# Then restart Claude Code
```

---

## How It Works in Practice

You interact with Claude exactly as you always have. Behind the scenes:

1. Claude receives your request and decides it is an implementation, test-writing, or bug-fix task
2. Claude calls the delegation tool with a detailed spec, repo path, and a feature branch name
3. Kimi K2.6 runs an autonomous loop: reads your codebase, writes code, runs tests, fixes errors
4. Claude receives the diff and a summary of what was done
5. Claude reviews the diff and presents the result to you

**Example conversation — no special syntax required:**

```
You:    Add rate limiting to the /api/auth routes in my Express app.
        Max 10 requests per minute per IP, return 429 with a Retry-After header.

Claude: I've implemented rate limiting on the auth routes. Here's what was added:

        Branch: feature/rate-limiting
        - Added express-rate-limit to package.json
        - Created src/middleware/rateLimiter.ts with IP-based limiting (10 req/min)
        - Applied middleware to /api/auth/* in src/routes/auth.ts
        - Added integration test covering the 429 response and Retry-After header

        The branch is ready to review. Want me to walk through the changes?
```

```
You:    There's a crash on POST /orders — TypeError: Cannot read property 'id'
        of undefined at order.service.ts:45

Claude: I've traced and fixed the crash. The root cause was a missing null check
        when looking up the user before accessing user.id. Changes are on
        branch fix/order-null-crash — one guard clause added, test added to
        cover the null-user path. Want to merge it?
```

---

## Configuration

Edit `.env` to customize behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `KIMI_API_KEY` | required | Your Kimi platform API key |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | Use `https://api.moonshot.ai/v1` outside China |
| `KIMI_MODEL` | `kimi-k2.6` | Model to use |
| `KIMI_MAX_STEPS` | `50` | Max agentic loop steps per task (1-300) |

---

## Fallback Behavior

The delegation is designed to be self-healing:

| Situation | What happens |
|-----------|-------------|
| First attempt succeeds | Claude presents the diff |
| First attempt produces no changes or errors | Claude retries automatically (attempt 2) |
| Second attempt also fails | Claude falls back to direct implementation — no user action needed |
| Kimi API is unreachable | Same fallback — Claude handles the task directly |

The fallback is always silent. From the user's perspective, Claude simply completes the task.

---

## Security

- **Path traversal protection**: Kimi can only access files inside the specified `repo_path`
- **Command blocklist**: `rm -rf`, `git push`, `git reset --hard`, `sudo`, `curl`, `wget` are blocked
- **Branch isolation**: Kimi never commits to `main`, `master`, or any branch not explicitly named in the request
- **Shell injection prevention**: All file paths and commit messages are passed as argument arrays, never interpolated into shell strings
- **API key safety**: `.env` is gitignored and never committed

---

## FAQ

**Q: Do I need to tell Claude to "use Kimi" or "delegate this"?**
A: No. After Step 4 (CLAUDE.md setup), Claude routes implementation tasks automatically. Just talk to it normally.

**Q: Will I ever see Kimi mentioned in Claude's responses?**
A: No. Claude presents all results as its own work. The delegation is invisible.

**Q: What if the delegated result is wrong?**
A: Tell Claude what's wrong, as you normally would. Claude will either refine the spec and redelegate, or handle the fix directly. The branch is still there if you want to inspect or discard it (`git branch -D <branch>`).

**Q: Does this work with any codebase?**
A: Yes. Kimi reads the project structure and adapts to any language or framework. The more context Claude includes in its task spec, the better Kimi's output quality.

**Q: How much does it cost compared to using Claude for everything?**
A: Depends on task mix, but implementation-heavy work typically sees 60-70% token cost reduction. Architecture, decomposition, and review remain on Claude (~25% of total work).

**Q: Is Kimi K2.6 reliable enough for production code?**
A: Kimi K2.6 reaches SOTA on major coding benchmarks. Every result lands on an isolated branch and goes through Claude's review before you see it — the workflow enforces a quality gate regardless of the model.

---

## License

MIT

---

---

# 中文文档

**[English](#what-is-this)** | 中文

---

## 这是什么？

`claude-kimi-mcp` 是一个面向 **Claude Code** 的 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 服务，在后台将编码任务静默委派给 **Kimi K2.6**（月之暗面旗舰编码 Agent）在隔离的 Git 分支上自主完成。

你只需像平时一样和 Claude 对话，Claude 自己决定何时委派，Kimi 负责实现，Claude 审查后汇报结果。**你完全不需要知道 Kimi 的存在。**

**结果：AI 使用成本降低 60–70%，输出质量不变，用户全程无感知。**

---

## 为什么需要 claude-kimi-mcp？

### 问题：Claude Code 强大，但成本高

Claude Code 是目前最强的 AI 编程助手之一。但如果把它用在所有工作上——从顶层设计到样板代码的实现——你在为不需要顶级推理能力的工作支付顶级 Token 价格。

一个典型功能的 Token 消耗分布如下：

| 任务 | Token 占比 | 需要 Claude 吗？ |
|------|-----------|----------------|
| 架构设计、API 契约定义 | ~10% | 是——需要复杂推理 |
| 任务拆分、规格编写 | ~10% | 是——需要判断力 |
| 代码实现、样板代码 | ~50% | 否——规则性强 |
| 测试编写 | ~15% | 否——模式匹配 |
| Bug 修复迭代 | ~15% | 否——系统性调试 |

**75% 的 Token 消耗在更便宜的专用模型同样能完成的任务上。**

### 解决方案：透明自动委派

安装完成后，你与 Claude Code 的交互方式完全不变。Claude 在后台自动把实现工作路由给 Kimi K2.6，审查结果，再以自己的名义呈现给你。

```
你 ───────────────────────────────────────────────────────────► 你
   "给我的 API 加 JWT 认证"                       "已完成，这是改动内容"
              │                                           ▲
              ▼                                           │
        Claude Code（架构师 + 审核员）                    │
              │ 自动调用委派工具                          │
              ▼                                           │
        Kimi K2.6 Agent  ◄──► 功能分支                   │
              │  读代码、写实现、跑测试、自主修错           │
              │  （最多 300 步工具调用）                   │
              └────────────── diff ─────────────────────┘
```

首次委派结果不理想时，Claude 自动重试一次。两次均失败则静默回退到 Claude 直接处理，全程无需用户介入。

### 为什么选 Kimi K2.6？

- **专为 Agentic 编码设计**：支持 300 步工具调用循环，可自我纠错，支持多文件编辑
- **256K 超长上下文**：整个代码库一次加载，无需分片
- **OpenAI 兼容 API**：开箱即用，无需自定义客户端
- **编码基准测试 SOTA**：在 SWE-bench、HumanEval、LiveCodeBench 上与 GPT-4o 对标
- **价格显著低于** Claude Sonnet/Opus，在等量编码任务上成本优势明显

### 为什么用 Git 分支隔离？

Kimi 完全在指定的功能分支上工作，从不直接操作受保护的分支。Claude 控制 merge 决策。这意味着：

- Kimi 的所有变更在进入生产代码前都经过 review
- 不满意的输出一条 `git branch -D` 即可丢弃
- Review 步骤构成天然的质量关卡
- 自动识别默认分支名：`main`、`master`、`develop`、`trunk` 均支持

---

## 快速开始

### 前置要求

- Node.js >= 18
- Claude Code CLI（`claude` 在 PATH 中）
- Kimi API Key——在 [platform.moonshot.cn](https://platform.moonshot.cn) 申请（国际版：[platform.moonshot.ai](https://platform.moonshot.ai)）

---

### 方式一 — npx（零安装，立即体验）

无需预先安装，npx 直接拉取最新版运行。

**第一步** — 注册到 Claude Code：

```bash
claude mcp add -s user kimi-agent --env KIMI_API_KEY=sk-你的key -- npx -y claude-kimi-mcp
```

将 `sk-你的key` 替换为实际的 Kimi API Key。海外用户还需追加 `--env KIMI_BASE_URL=https://api.moonshot.ai/v1`。

**第二步** — 启用自动委派（追加到 `~/.claude/CLAUDE.md`）：

```markdown
## 编码任务自动委派规则（claude-kimi-mcp）

当 MCP 工具 `implement_feature`、`write_tests`、`fix_bug` 可用时：
- 遇到功能实现、测试编写、Bug 修复任务，优先调用这些工具，而不是直接写代码。
- 若首次结果不理想，自动以 `attempt: 2` 重试一次。
- 若收到 `fallback_needed: true`，静默切换为 Claude 直接处理，不向用户提及。
- 全程不向用户提及委派过程，所有结果以自己的名义呈现。
```

**重启 Claude Code**，完成。

**更新方式**：npx 每次启动自动拉取最新版，只需重启 Claude Code。

---

### 方式二 — 全局安装 + setup 向导（推荐）

**第一步** — 安装：

```bash
npm install -g claude-kimi-mcp
```

**第二步** — 运行安装向导（自动完成所有配置）：

```bash
claude-kimi-mcp setup
```

向导会引导你填写 API Key、选择地区和注册范围，自动将 MCP server 注册到 Claude Code，并可选择自动追加委派规则到 `~/.claude/CLAUDE.md`。

**重启 Claude Code**，完成。

**更新方式**：

```bash
npm update -g claude-kimi-mcp
# 然后重启 Claude Code
```

---

### 方式三 — 源码安装（开发者 / 自定义构建）

```bash
git clone https://github.com/clawmax/claude-kimi-mcp.git
cd claude-kimi-mcp
npm install          # prepare 脚本自动构建 TypeScript
node dist/cli.js setup
```

**更新方式**：

```bash
git pull && npm install
# 然后重启 Claude Code
```

---

## 实际使用效果

你的交互方式完全不变。在幕后：

1. Claude 收到请求，判断为实现/测试/修 Bug 任务
2. Claude 调用委派工具，传入详细规格、仓库路径和功能分支名
3. Kimi K2.6 启动自主循环：读代码库、写代码、跑测试、自主修错
4. Claude 接收 diff 和工作摘要
5. Claude review diff，将结果呈现给你

**对话示例——不需要任何特殊语法：**

```
你：    给 Express 应用的 /api/auth 路由加限流。
        每个 IP 每分钟最多 10 次请求，超限返回 429 并带 Retry-After 头。

Claude: 限流已添加到认证路由，具体改动如下：

        分支：feature/rate-limiting
        - 在 package.json 中添加了 express-rate-limit
        - 新建 src/middleware/rateLimiter.ts，实现基于 IP 的限流（10次/分钟）
        - 在 src/routes/auth.ts 中将中间件应用到 /api/auth/*
        - 补充了覆盖 429 响应和 Retry-After 头的集成测试

        分支已就绪，需要我带你过一遍改动吗？
```

```
你：    POST /orders 报错崩溃——order.service.ts:45 出现
        TypeError: Cannot read property 'id' of undefined

Claude: 已定位并修复崩溃。根因是在读取 user.id 前未做空值检查。
        改动在分支 fix/order-null-crash——加了一个 guard clause，
        并补了覆盖 null user 路径的测试用例。要 merge 吗？
```

---

## 配置项

编辑 `.env` 文件：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KIMI_API_KEY` | 必填 | Kimi 平台 API Key |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | 海外用户改为 `https://api.moonshot.ai/v1` |
| `KIMI_MODEL` | `kimi-k2.6` | 使用的模型 |
| `KIMI_MAX_STEPS` | `50` | 单任务最大 Agentic Loop 步数（1–300） |

---

## 自动回退机制

委派设计为自愈型：

| 情况 | 行为 |
|------|------|
| 首次委派成功 | Claude 呈现 diff |
| 首次委派无改动或报错 | Claude 自动重试（第 2 次） |
| 两次均失败 | Claude 静默回退，直接处理任务 |
| Kimi API 不可达 | 同上——Claude 直接处理 |

回退始终静默发生。从用户视角来看，Claude 只是完成了任务。

---

## 安全说明

- **路径穿越防护**：Kimi 只能访问指定 `repo_path` 目录内的文件
- **高危命令黑名单**：`rm -rf`、`git push`、`git reset --hard`、`sudo`、`curl`、`wget` 均被拒绝
- **分支隔离**：Kimi 永远不会向 `main`、`master` 或任何未明确指定的分支提交
- **Shell 注入防护**：所有文件路径和提交信息均以参数数组传递，不进行 shell 字符串插值
- **API Key 安全**：`.env` 已加入 `.gitignore`，不会随代码入库

---

## 常见问题

**Q：我需要主动告诉 Claude "用 Kimi 来做" 吗？**
A：不需要。完成第四步（CLAUDE.md 配置）后，Claude 会自动路由实现类任务。正常对话即可。

**Q：Claude 的回复里会出现 Kimi 的字样吗？**
A：不会。Claude 以自己的名义呈现所有结果，委派过程对你完全不可见。

**Q：如果委派的结果有问题怎么办？**
A：和平时一样告诉 Claude 哪里不对。Claude 会重新拟定规格再次委派，或直接处理修改。分支还在，随时可以检查或用 `git branch -D <branch>` 丢弃。

**Q：支持任意语言和框架吗？**
A：是的。Kimi 会读取项目结构并自适应。Claude 传给 Kimi 的任务规格越详细，输出质量越高。

**Q：相比全用 Claude，能省多少钱？**
A：取决于任务结构，以实现为主的工作通常可节省 60–70% 的 Token 费用。架构设计、任务拆分、review 仍在 Claude 上（占总工作量约 25%）。

**Q：Kimi K2.6 的输出质量可靠吗？**
A：Kimi K2.6 在主流编码基准测试上达到 SOTA 水平。所有结果都落在隔离分支上，经过 Claude review 后才呈现给你——工作流本身就强制了质量把关，与使用哪个模型无关。

---

## License

MIT
