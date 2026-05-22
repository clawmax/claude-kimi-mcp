# claude-kimi-mcp

**English** | [中文](#中文文档)

---

## What Is This?

`claude-kimi-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for **Claude Code** that delegates coding tasks to **Kimi K2.6** — Moonshot AI's state-of-the-art coding agent — running on an isolated Git branch.

Claude Code handles what it does best: architecture, task decomposition, and code review. Kimi K2.6 handles what it does best: writing code, tests, and fixing bugs — autonomously, with up to 300 tool-calling steps per task.

**Result: 60–70% lower AI cost. Same output quality. Cleaner workflow.**

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

### The Solution: Split the Work by Model Strength

`claude-kimi-mcp` gives Claude Code a single MCP tool call to dispatch the implementation work to Kimi K2.6. Claude stays in the loop as the architect and reviewer — it just stops paying for keystrokes.

```
You ──► Claude Code (architect + reviewer)
              │
              │ implement_feature(spec, repo, branch)
              ▼
        Kimi K2.6 Agent  ◄──► your codebase (on a git branch)
              │  reads files, writes code, runs tests, fixes errors
              ▼
        Returns diff summary
              │
              ▼
        Claude reviews diff ──► merge or revise
```

### Why Kimi K2.6 Specifically?

- **Purpose-built for agentic coding**: 300-step tool-calling loop, self-correction, multi-file edits
- **256K context window**: can load entire codebases without chunking
- **OpenAI-compatible API**: drop-in integration, no custom client needed
- **SOTA on coding benchmarks**: competes with GPT-4o on SWE-bench, HumanEval, and LiveCodeBench
- **Significantly cheaper** than Claude Sonnet/Opus for equivalent coding tasks

### Why Git Branch Isolation?

Kimi works entirely on a named feature branch — never on `main`. Claude controls the merge decision. This means:

- Kimi's changes are always reviewable before they touch production code
- Bad outputs are one `git branch -D` away from disappearing
- The review step forces a natural quality gate

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Claude Code CLI (`claude` in PATH)
- Kimi API Key — get one at [platform.moonshot.cn](https://platform.moonshot.cn) (or [platform.moonshot.ai](https://platform.moonshot.ai) outside China)

### Install

```bash
git clone https://github.com/clawmax/claude-kimi-mcp.git
cd claude-kimi-mcp
npm install          # auto-builds TypeScript via prepare script
```

### Configure

```bash
cp .env.example .env
# Edit .env and set your KIMI_API_KEY
```

### Register with Claude Code

```bash
claude mcp add -s user kimi-agent -- /absolute/path/to/claude-kimi-mcp/start.sh
```

Replace `/absolute/path/to/` with the actual path on your machine.

**Restart Claude Code.** The three tools are now available in every project.

---

## MCP Tools

### `implement_feature`

Implement a feature on a Git branch. Kimi reads the codebase, writes the implementation, runs tests, and iterates until the task is done.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `repo_path` | string | Absolute path to the repository |
| `branch_name` | string | Git branch for Kimi to work on (created if it doesn't exist) |
| `task_spec` | string | Detailed spec: what to build, style requirements, acceptance criteria |

**Example prompt to Claude Code:**
```
Use implement_feature to add JWT authentication to /Users/me/my-api.
Branch: feature/jwt-auth
Spec: implement POST /auth/login returning a signed JWT, follow the existing
Express middleware pattern in src/middleware/, add integration tests.
```

---

### `write_tests`

Write tests for existing code, matching the project's existing test framework and style.

**Example prompt:**
```
Use write_tests on /Users/me/my-api, branch feature/add-tests.
Target: src/services/UserService.ts — cover create, update, delete,
including error paths and edge cases.
```

---

### `fix_bug`

Given a bug description or stack trace, Kimi locates the root cause, fixes it, and verifies the fix with tests.

**Example prompt:**
```
Use fix_bug on /Users/me/my-api, branch fix/order-crash.
Bug: POST /orders throws "TypeError: Cannot read property 'id' of undefined"
at order.service.ts:45. Stack trace: [paste here]
```

---

## Configuration

Edit `.env` to customize behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `KIMI_API_KEY` | required | Your Kimi platform API key |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | Use `https://api.moonshot.ai/v1` outside China |
| `KIMI_MODEL` | `kimi-k2.6` | Model to use |
| `KIMI_MAX_STEPS` | `50` | Max agentic loop steps per task (1–300) |

---

## Security

- **Path traversal protection**: Kimi can only access files inside the specified `repo_path`
- **Command blocklist**: `rm -rf`, `git push`, `git reset --hard`, `sudo`, `curl`, `wget` are blocked
- **Branch isolation**: Kimi never commits to `main` or any branch you don't explicitly name
- **API key safety**: `.env` is gitignored and never committed

---

## FAQ

**Q: Does this work with any codebase?**
A: Yes. Kimi reads the project structure and adapts to any language or framework. Providing a clear `task_spec` with style references improves output quality.

**Q: What if Kimi's output is wrong?**
A: Claude reviews the diff before anything is merged. You can ask Claude to pass feedback back to Kimi for another iteration, or simply discard the branch.

**Q: How much does it cost compared to using Claude for everything?**
A: Depends on task mix, but implementation-heavy work typically sees 60–70% token cost reduction. Architecture and review remain on Claude (10–20% of total tokens).

**Q: Is Kimi K2.6 reliable enough for production code?**
A: Kimi K2.6 reaches SOTA on major coding benchmarks. Like any AI output, the output should be reviewed — which is exactly what the Git branch + Claude review workflow enforces.

---

## License

MIT

---

---

# 中文文档

**[English](#what-is-this)** | 中文

---

## 这是什么？

`claude-kimi-mcp` 是一个面向 **Claude Code** 的 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 服务，将编码任务委派给 **Kimi K2.6**（月之暗面旗舰编码 Agent）在隔离的 Git 分支上自主完成。

Claude Code 专注它最擅长的：架构设计、任务拆分、代码 Review。Kimi K2.6 专注它最擅长的：写代码、写测试、修 Bug——自主运行，单任务最多支持 300 步工具调用。

**结果：AI 使用成本降低 60–70%，输出质量不变，工作流更清晰。**

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

### 解决方案：按模型优势分工

`claude-kimi-mcp` 让 Claude Code 通过一个 MCP 工具调用，把实现工作派发给 Kimi K2.6。Claude 继续作为架构师和审查员——只是不再为敲键盘付费。

```
你 ──► Claude Code（架构师 + 审核员）
              │
              │ implement_feature(spec, repo, branch)
              ▼
        Kimi K2.6 Agent  ◄──► 你的代码库（在 Git 分支上）
              │  读代码、写实现、跑测试、自主修复错误
              ▼
        返回 diff 摘要
              │
              ▼
        Claude review diff ──► merge 或打回
```

### 为什么选 Kimi K2.6？

- **专为 Agentic 编码设计**：支持 300 步工具调用循环，可自我纠错，支持多文件编辑
- **256K 超长上下文**：整个代码库一次加载，无需分片
- **OpenAI 兼容 API**：开箱即用，无需自定义客户端
- **编码基准测试 SOTA**：在 SWE-bench、HumanEval、LiveCodeBench 上与 GPT-4o 对标
- **价格显著低于** Claude Sonnet/Opus，在等量编码任务上成本优势明显

### 为什么用 Git 分支隔离？

Kimi 完全在指定的功能分支上工作，从不直接操作 `main`。Claude 控制 merge 决策。这意味着：

- Kimi 的所有变更在进入生产代码前都经过 review
- 不满意的输出一条 `git branch -D` 即可丢弃
- Review 步骤构成天然的质量关卡

---

## 快速开始

### 前置要求

- Node.js ≥ 18
- Claude Code CLI（`claude` 在 PATH 中）
- Kimi API Key——在 [platform.moonshot.cn](https://platform.moonshot.cn) 申请

### 安装

```bash
git clone https://github.com/clawmax/claude-kimi-mcp.git
cd claude-kimi-mcp
npm install          # prepare 脚本自动构建 TypeScript
```

### 配置

```bash
cp .env.example .env
# 编辑 .env，填入你的 KIMI_API_KEY
```

### 注册到 Claude Code

```bash
claude mcp add -s user kimi-agent -- /绝对路径/claude-kimi-mcp/start.sh
```

将 `/绝对路径/` 替换为实际路径，例如 `/Users/yourname/workspace/claude-kimi-mcp/start.sh`。

**重启 Claude Code**，三个工具在所有项目中立即可用。

---

## MCP 工具

### `implement_feature` — 实现功能

在 Git 分支上自主实现一个功能。Kimi 读取代码库、编写实现、运行测试，迭代直到完成。

**在 Claude Code 中的使用示例：**
```
用 implement_feature 给 /Users/me/my-api 的 feature/jwt-auth 分支
添加 JWT 认证。要求：实现 POST /auth/login 返回签名 JWT，
参考 src/middleware/ 的现有 Express 中间件风格，并补充集成测试。
```

---

### `write_tests` — 编写测试

为现有代码编写测试，自动匹配项目已有的测试框架和风格。

**示例：**
```
用 write_tests 给 /Users/me/my-api 的 feature/add-tests 分支
为 src/services/UserService.ts 编写测试，覆盖 create、update、delete
方法的正常路径、边界情况和错误路径。
```

---

### `fix_bug` — 修复 Bug

根据 Bug 描述或错误堆栈定位根因、修复并验证。

**示例：**
```
用 fix_bug 在 /Users/me/my-api 的 fix/order-crash 分支修复这个 Bug：
POST /orders 报错 "TypeError: Cannot read property 'id' of undefined"
位置在 order.service.ts:45。错误堆栈：[粘贴堆栈]
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

## 安全说明

- **路径穿越防护**：Kimi 只能访问指定 `repo_path` 目录内的文件
- **高危命令黑名单**：`rm -rf`、`git push`、`git reset --hard`、`sudo`、`curl`、`wget` 均被拒绝
- **分支隔离**：Kimi 永远不会向 `main` 或你未明确指定的分支提交
- **API Key 安全**：`.env` 已加入 `.gitignore`，不会随代码入库

---

## 常见问题

**Q：支持任意语言和框架吗？**
A：是的。Kimi 会读取项目结构并自适应。`task_spec` 中提供风格参考文件路径可以提升输出质量。

**Q：如果 Kimi 的输出有问题怎么办？**
A：Claude 在 merge 前 review diff。你可以让 Claude 把反馈传回给 Kimi 再迭代，或直接丢弃该分支。

**Q：相比全用 Claude，能省多少钱？**
A：取决于任务结构，以实现为主的工作通常可节省 60–70% 的 Token 费用。架构和 Review 仍在 Claude 上（占总 Token 的 10–20%）。

**Q：Kimi K2.6 的输出质量可靠吗？**
A：Kimi K2.6 在主流编码基准测试上达到 SOTA 水平。和所有 AI 输出一样，建议 review 后再 merge——这正是 Git 分支 + Claude Review 工作流所强制要求的。

---

## License

MIT
