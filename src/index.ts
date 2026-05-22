import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import { runKimiAgent } from "./agent-loop.js";

const COMMON_PARAMS = {
  repo_path: z.string().describe("Absolute path to the repository"),
  branch_name: z.string().describe("Git branch to work on (created automatically if it does not exist)"),
  attempt: z
    .number()
    .int()
    .min(1)
    .max(2)
    .default(1)
    .describe(
      "Attempt number (1 = first try, 2 = retry). " +
      "On attempt 2, if no meaningful changes are produced, the tool returns fallback_needed:true " +
      "indicating Claude should handle the task directly."
    ),
};

export function formatResult(
  branchName: string,
  result: Awaited<ReturnType<typeof runKimiAgent>>
) {
  if (result.fallback_needed) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            fallback_needed: true,
            reason: "Two attempts produced no meaningful changes. Claude should handle this task directly.",
            branch: branchName,
            last_attempt_summary: result.summary,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `## Completion Report`,
          `- Branch: \`${branchName}\``,
          `- Steps: ${result.steps}`,
          `- Status: ${result.success ? "success" : "partial — please review"}`,
          ``,
          `### Summary`,
          result.summary,
          ``,
          `### Git Diff (review before merging)`,
          "```diff",
          result.diff,
          "```",
        ].join("\n"),
      },
    ],
  };
}

export async function startServer() {
  if (!process.env.KIMI_API_KEY) {
    process.stderr.write("[claude-kimi-mcp] Error: KIMI_API_KEY environment variable is not set\n");
    process.exit(1);
  }

  const server = new McpServer({
    name: "claude-kimi-mcp",
    version: "0.2.0",
  });

  server.registerTool(
    "implement_feature",
    {
      description:
        "[Auto-delegation tool] Claude should call this tool first whenever it needs to implement " +
        "a feature, new module, or significant code change — instead of writing code directly. " +
        "The tool runs an autonomous agent on an isolated Git branch, implements the task, runs tests, " +
        "and returns a diff for review. If it returns fallback_needed:true, Claude must handle the task directly.",
      inputSchema: {
        ...COMMON_PARAMS,
        task_spec: z
          .string()
          .describe("Detailed task spec: feature description, relevant files, style requirements, acceptance criteria"),
      },
    },
    async ({ repo_path, branch_name, task_spec, attempt }) => {
      try {
        const result = await runKimiAgent(repo_path, branch_name, task_spec, attempt);
        return formatResult(branch_name, result);
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `[implement_feature failed]\n${e.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "write_tests",
    {
      description:
        "[Auto-delegation tool] Claude should call this tool first whenever it needs to write tests " +
        "for existing code. The tool analyzes the existing test style and writes tests covering the main scenarios. " +
        "If it returns fallback_needed:true, Claude must write the tests directly.",
      inputSchema: {
        ...COMMON_PARAMS,
        task_spec: z
          .string()
          .describe("Test task spec: target module/function, scenarios to cover, test framework in use"),
      },
    },
    async ({ repo_path, branch_name, task_spec, attempt }) => {
      const enrichedSpec =
        `[Task type: write tests]\n${task_spec}\n\n` +
        `Requirements: match existing test file style; cover happy paths, edge cases, and error paths; ensure all new tests pass.`;
      try {
        const result = await runKimiAgent(repo_path, branch_name, enrichedSpec, attempt);
        return formatResult(branch_name, result);
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `[write_tests failed]\n${e.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "fix_bug",
    {
      description:
        "[Auto-delegation tool] Claude should call this tool first whenever it needs to locate and fix a bug. " +
        "The tool analyzes the error, identifies the root cause, applies a fix, and verifies with tests. " +
        "If it returns fallback_needed:true, Claude must fix the bug directly.",
      inputSchema: {
        ...COMMON_PARAMS,
        bug_description: z
          .string()
          .describe("Bug description: error message, reproduction steps, expected vs actual behavior, stack trace if available"),
      },
    },
    async ({ repo_path, branch_name, bug_description, attempt }) => {
      const taskSpec =
        `[Task type: fix bug]\n${bug_description}\n\n` +
        `Requirements: identify root cause before fixing; ensure related tests pass after the fix; do not introduce unrelated changes.`;
      try {
        const result = await runKimiAgent(repo_path, branch_name, taskSpec, attempt);
        return formatResult(branch_name, result);
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `[fix_bug failed]\n${e.message}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[claude-kimi-mcp] Server started, waiting for Claude Code connection...\n");
}

// 直接运行时才启动 server
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
