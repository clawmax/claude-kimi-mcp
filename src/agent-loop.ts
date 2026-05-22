import OpenAI from "openai";
import { execFileSync } from "child_process";
import { executeSandboxTool, getSandboxToolDefinitions, gitCreateBranch, gitDiff } from "./sandbox-tools.js";

export function detectBaseBranch(repoRoot: string): string {
  // Prefer the remote default branch; fall back to common names; last resort: HEAD
  const candidates = ["main", "master", "develop", "trunk"];
  for (const name of candidates) {
    try {
      execFileSync("git", ["rev-parse", "--verify", name], { cwd: repoRoot, stdio: "pipe" });
      return name;
    } catch {
      // branch doesn't exist, try next
    }
  }
  return "HEAD";
}

function createClient() {
  return new OpenAI({
    apiKey: process.env.KIMI_API_KEY!,
    baseURL: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
  });
}

export interface AgentResult {
  success: boolean;
  summary: string;
  diff: string;
  steps: number;
  /** When true, the task exceeded delegation capability — caller should handle it directly */
  fallback_needed: boolean;
  error?: string;
}

const SYSTEM_PROMPT = `You are a professional software engineer agent. You will receive a coding task spec and must implement it in the given repository.

Workflow:
1. Use list_dir and read_file to understand the codebase structure and relevant files
2. Form an implementation plan, then write code step-by-step using write_file
3. Use bash_exec to run tests or type checks to verify correctness
4. If there are errors, read the output and fix them
5. When all work is complete, call git_commit then task_done

Rules:
- Implement exactly what the task spec requires — do not add extra features
- Match the existing code style of the project
- Ensure all tests pass before finishing (if the project has tests)
- Write clear, concise commit messages in English`;

export async function runKimiAgent(
  repoRoot: string,
  branchName: string,
  taskSpec: string,
  attempt: number = 1
): Promise<AgentResult> {
  const client = createClient();
  const MODEL = process.env.KIMI_MODEL ?? "kimi-k2.6";
  const MAX_STEPS = parseInt(process.env.KIMI_MAX_STEPS ?? "50", 10);

  gitCreateBranch(repoRoot, branchName);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Repository: ${repoRoot}\nBranch: ${branchName}\n\nTask spec:\n${taskSpec}`,
    },
  ];

  const tools = getSandboxToolDefinitions();
  let steps = 0;
  let finalSummary = "";
  let taskFailed = false;

  try {
    while (steps < MAX_STEPS) {
      steps++;

      const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        finalSummary = assistantMsg.content ?? "Task complete (no summary provided)";
        break;
      }

      let isDone = false;
      for (const toolCall of assistantMsg.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = executeSandboxTool(repoRoot, toolCall.function.name, args);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        } as OpenAI.Chat.ChatCompletionToolMessageParam);

        if (result.startsWith("__TASK_DONE__:")) {
          finalSummary = result.slice("__TASK_DONE__:".length);
          isDone = true;
        }
      }

      if (isDone) break;
    }
  } catch (e: any) {
    taskFailed = true;
    finalSummary = `Execution error: ${e.message}`;
  }

  const baseBranch = detectBaseBranch(repoRoot);
  const diff = gitDiff(repoRoot, baseBranch);
  const hasChanges = diff.trim().length > 0 && diff !== "[No changes]";

  // Trigger fallback on attempt >= 2 with no meaningful changes or execution error
  const fallback_needed = attempt >= 2 && (!hasChanges || taskFailed);

  return {
    success: !taskFailed && hasChanges,
    summary: finalSummary || `Completed in ${steps} steps`,
    diff: diff || "[No changes]",
    steps,
    fallback_needed,
    error: taskFailed ? finalSummary : undefined,
  };
}
