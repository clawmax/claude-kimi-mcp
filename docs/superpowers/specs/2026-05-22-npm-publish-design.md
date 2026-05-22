# npm 发布 & 多种安装方式设计文档

**日期**：2026-05-22
**状态**：已确认，待实现

---

## 背景

当前安装方式仅支持 git clone + 手动配置路径，用户需要知道本地绝对路径才能完成 `claude mcp add` 注册。目标是将项目发布为 npm 包，支持 npx 零安装、全局安装 + 向导、源码安装三种方式，并回答"如何更新 MCP"的问题。

---

## 方案选择

选用**方案 B**：废弃 `start.sh`，将 shell 脚本职责全部迁移到 `src/cli.ts`（Node.js 实现），跨平台友好（兼容 Windows），同时新增 `setup` 子命令作为安装向导。

放弃方案 A（最小改动）和方案 C（独立 CLI 包）。

---

## 架构设计

### 1. 入口文件 & 运行模式

新建 `src/cli.ts`，编译产物为 `dist/cli.js`，顶部带 `#!/usr/bin/env node` shebang。

运行模式：

| 命令 | 行为 |
|------|------|
| `claude-kimi-mcp` | 启动 MCP server（默认） |
| `claude-kimi-mcp setup` | 交互式安装向导 |
| `claude-kimi-mcp --version` | 打印版本号 |

`package.json` 新增字段：

```json
"bin": { "claude-kimi-mcp": "./dist/cli.js" },
"files": ["dist/", "README.md", ".env.example"]
```

`start.sh` 删除。git clone 用户改用 `node dist/cli.js` 或 `npx claude-kimi-mcp`。

### 2. 配置加载顺序

`loadConfig()` 函数按以下优先级读取，全部用 Node 原生 `fs` 实现，不引入 `dotenv`：

```
1. 进程环境变量（KIMI_API_KEY 等）         ← claude mcp add --env 注入
2. ~/.claude-kimi-mcp/.env                ← setup 向导写入
3. ./.env（当前工作目录）                  ← git clone 用户兼容
```

前一层有值则后层跳过。`loadConfig()` 同时供 server 启动和 setup 向导预检复用。

### 3. setup 向导流程

运行 `claude-kimi-mcp setup`，使用 Node 内置 `readline` 模块，不引入额外依赖：

```
步骤 1：询问 KIMI_API_KEY（输入时隐藏字符）
步骤 2：询问地区 → China / International（自动设置 KIMI_BASE_URL）
步骤 3：询问 MCP 注册 scope → user（推荐）/ project / local
步骤 4：将 Key + URL 写入 ~/.claude-kimi-mcp/.env（自动创建目录）
步骤 5：执行 claude mcp add -s <scope> kimi-agent -- npx -y claude-kimi-mcp
步骤 6：询问是否追加自动委派规则到 ~/.claude/CLAUDE.md
步骤 7：打印完成提示 + 重启 Claude Code 的提醒
```

安全检查：
- 步骤 5 前检查 `claude` 命令是否存在；不存在则打印命令让用户手动执行
- 步骤 6 追加前检查 CLAUDE.md 是否已包含委派规则，避免重复写入

### 4. README 安装方式重构

「Quick Start」章节重构为三种并列安装方式（中英双语同步）：

**方式一：npx（零安装）**
```bash
claude mcp add -s user kimi-agent --env KIMI_API_KEY=sk-xxx -- npx -y claude-kimi-mcp
```
适合快速试用，无需预先安装，每次启动时自动拉取最新版。

**方式二：全局安装 + setup 向导（推荐）**
```bash
npm install -g claude-kimi-mcp
claude-kimi-mcp setup
```
适合长期使用，向导自动完成所有配置。

**方式三：源码安装（开发者 / 自定义）**
```bash
git clone https://github.com/clawmax/claude-kimi-mcp.git
cd claude-kimi-mcp && npm install
node dist/cli.js setup
```
适合需要修改源码的用户。

新增「更新方式」章节：

| 安装方式 | 更新命令 |
|---------|---------|
| npx | 自动获取最新版，无需操作，重启 Claude Code 即可 |
| npm 全局 | `npm update -g claude-kimi-mcp`，然后重启 Claude Code |
| 源码 | `git pull && npm install`，然后重启 Claude Code |

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/cli.ts` | 新建——CLI 入口 + setup 向导 |
| `src/index.ts` | 修改——导出 `startServer()` 函数供 cli.ts 调用 |
| `package.json` | 修改——新增 `bin`、`files` 字段 |
| `tsconfig.json` | 确认 `dist/cli.js` 在编译输出范围内 |
| `start.sh` | 删除 |
| `README.md` | 修改——重构安装章节，新增更新章节（中英双语） |

---

## 不在本次范围内

- npm 发布流程（`npm publish`、版本 tag）——由开发者手动执行
- CI/CD 自动发布
- Windows 专项测试（架构上已兼容，但不作为验收条件）
