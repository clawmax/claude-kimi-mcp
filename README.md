# kimi-agent-mcp

将 Kimi K2.6 包装成 Claude Code 可调用的编码 Agent。

Claude Code 负责架构规划和 Code Review，Kimi K2.6 负责在 Git 分支上自主实现代码、跑测试、修 Bug，完成后把 diff 返回给 Claude 审核再 merge。

## 工作流

```
Claude Code（架构师 + 审核员）
  └─ 调用 MCP tool（一次）
        ↓
  Kimi K2.6 Agentic Loop（在独立 Git 分支上）
    ├─ 读代码 / 理解上下文
    ├─ 写实现 / 写测试
    ├─ 跑测试 → 报错 → 自主修复
    └─ 完成 → 返回 diff 摘要
        ↓
  Claude review diff → merge 或打回
```

## 安装

### 前置要求

- Node.js >= 18
- Claude Code CLI
- [Kimi API Key](https://platform.moonshot.cn/)（在控制台申请）

### 步骤

```bash
# 1. 克隆项目
git clone <repo-url>
cd kimi-agent-mcp

# 2. 安装依赖（自动构建）
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 KIMI_API_KEY

# 4. 注册到 Claude Code（用户级，对所有项目生效）
claude mcp add -s user kimi-agent -- /绝对路径/kimi-agent-mcp/start.sh

# 5. 重启 Claude Code，工具生效
```

> **注意**：`start.sh` 中的路径必须是绝对路径，将上面的 `/绝对路径/` 替换为实际路径，例如 `/Users/yourname/workspace/kimi-agent-mcp/start.sh`。

## 配置项（.env）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KIMI_API_KEY` | 必填 | Kimi 平台 API Key |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | 国内用此地址；海外改为 `https://api.moonshot.ai/v1` |
| `KIMI_MODEL` | `kimi-k2.6` | 使用的模型 |
| `KIMI_MAX_STEPS` | `50` | 单次任务最大 Agentic Loop 步数 |

## Claude Code 中的使用方式

注册成功后，在 Claude Code 对话里直接描述任务，Claude 会自动判断何时调用这三个工具：

### `kimi_implement_feature` — 实现功能

```
帮我在 /Users/me/my-project 的 feature/add-login 分支上实现用户登录功能。
要求：使用 JWT，参考现有的 register 接口风格，完成后返回 diff。
```

### `kimi_write_tests` — 编写测试

```
为 /Users/me/my-project 的 UserService 编写单元测试，
覆盖 create / update / delete 三个方法的正常路径和边界情况。
```

### `kimi_fix_bug` — 修复 Bug

```
/Users/me/my-project 里有个 bug：
调用 POST /api/orders 时报 TypeError: Cannot read property 'id' of undefined
错误堆栈在 order.service.ts:45，帮我定位并修复。
```

## 安全说明

- Kimi Agent 只能在指定的 `repo_path` 目录内操作，路径穿越会被拒绝
- 禁止 `rm -rf`、`git push`、`git reset --hard`、`sudo` 等高危命令
- 始终在独立 Git 分支工作，不直接修改 `main` 分支
- `.env` 已加入 `.gitignore`，API Key 不会入库

## 本地开发

```bash
# 修改源码后重新构建
npm run build

# 查看 MCP Server 是否注册成功
claude mcp list
```
