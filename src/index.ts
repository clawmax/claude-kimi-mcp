import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runKimiAgent } from "./agent-loop.js";

if (!process.env.KIMI_API_KEY) {
  process.stderr.write("[kimi-agent-mcp] 错误: 未设置 KIMI_API_KEY 环境变量\n");
  process.exit(1);
}

const server = new McpServer({
  name: "kimi-agent",
  version: "0.1.0",
});

// ── 工具一：实现功能 ──────────────────────────────────────────────────────────
server.registerTool(
  "kimi_implement_feature",
  {
    description:
      "让 Kimi K2.6 在指定代码库的 Git 分支上自主实现一个功能。Kimi 会读取代码库、编写代码、跑测试、自主修复错误，完成后返回 diff 供 Claude review。",
    inputSchema: {
      repo_path: z.string().describe("代码库的绝对路径，例如 /Users/xxx/my-project"),
      branch_name: z.string().describe("Kimi 工作的 Git 分支名，不存在时自动创建"),
      task_spec: z
        .string()
        .describe(
          "详细的任务规格：要实现什么功能、相关文件、代码风格要求、验收标准等。越详细越好。"
        ),
    },
  },
  async ({ repo_path, branch_name, task_spec }) => {
    try {
      const result = await runKimiAgent(repo_path, branch_name, task_spec);
      return {
        content: [
          {
            type: "text",
            text: [
              `## Kimi 完成报告`,
              `- 分支: ${branch_name}`,
              `- 步骤数: ${result.steps}`,
              ``,
              `### 完成摘要`,
              result.summary,
              ``,
              `### Git Diff（请 review 后再 merge）`,
              "```diff",
              result.diff,
              "```",
            ].join("\n"),
          },
        ],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `[kimi_implement_feature 失败]\n${e.message}` }],
        isError: true,
      };
    }
  }
);

// ── 工具二：编写测试 ──────────────────────────────────────────────────────────
server.registerTool(
  "kimi_write_tests",
  {
    description:
      "让 Kimi K2.6 为指定代码编写测试。Kimi 会分析现有测试风格，编写覆盖主要场景的测试，并确保测试通过。",
    inputSchema: {
      repo_path: z.string().describe("代码库的绝对路径"),
      branch_name: z.string().describe("Kimi 工作的 Git 分支名"),
      task_spec: z
        .string()
        .describe("测试任务规格：要测试什么模块/函数、需要覆盖哪些场景、使用什么测试框架"),
    },
  },
  async ({ repo_path, branch_name, task_spec }) => {
    const enrichedSpec = `【任务类型：编写测试】\n${task_spec}\n\n要求：\n- 参考已有测试文件的风格和框架\n- 覆盖正常路径、边界条件、错误路径\n- 确保所有新测试都通过`;
    try {
      const result = await runKimiAgent(repo_path, branch_name, enrichedSpec);
      return {
        content: [
          {
            type: "text",
            text: [
              `## Kimi 测试编写完成`,
              `- 分支: ${branch_name}`,
              `- 步骤数: ${result.steps}`,
              ``,
              `### 完成摘要`,
              result.summary,
              ``,
              `### Git Diff`,
              "```diff",
              result.diff,
              "```",
            ].join("\n"),
          },
        ],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `[kimi_write_tests 失败]\n${e.message}` }],
        isError: true,
      };
    }
  }
);

// ── 工具三：修复 Bug ──────────────────────────────────────────────────────────
server.registerTool(
  "kimi_fix_bug",
  {
    description:
      "让 Kimi K2.6 自主定位并修复一个 bug。需要提供错误信息或 bug 描述，Kimi 会分析代码、定位根因、修复并验证。",
    inputSchema: {
      repo_path: z.string().describe("代码库的绝对路径"),
      branch_name: z.string().describe("Kimi 工作的 Git 分支名"),
      bug_description: z
        .string()
        .describe(
          "Bug 描述：错误信息、复现步骤、预期行为 vs 实际行为。可以包含错误堆栈。"
        ),
    },
  },
  async ({ repo_path, branch_name, bug_description }) => {
    const taskSpec = `【任务类型：修复 Bug】\n${bug_description}\n\n要求：\n- 先定位根因，不要直接猜测\n- 修复后确保相关测试通过\n- 不要引入其他变更`;
    try {
      const result = await runKimiAgent(repo_path, branch_name, taskSpec);
      return {
        content: [
          {
            type: "text",
            text: [
              `## Kimi Bug 修复完成`,
              `- 分支: ${branch_name}`,
              `- 步骤数: ${result.steps}`,
              ``,
              `### 修复摘要`,
              result.summary,
              ``,
              `### Git Diff`,
              "```diff",
              result.diff,
              "```",
            ].join("\n"),
          },
        ],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `[kimi_fix_bug 失败]\n${e.message}` }],
        isError: true,
      };
    }
  }
);

// ── 启动 ──────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[kimi-agent-mcp] 已启动，等待 Claude Code 连接...\n");
