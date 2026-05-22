import OpenAI from "openai";
import { executeSandboxTool, getSandboxToolDefinitions, gitCreateBranch, gitDiff } from "./sandbox-tools.js";

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY!,
  baseURL: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
});

const MODEL = process.env.KIMI_MODEL ?? "kimi-k2.6";
const MAX_STEPS = parseInt(process.env.KIMI_MAX_STEPS ?? "50", 10);

export interface AgentResult {
  success: boolean;
  summary: string;
  diff: string;
  steps: number;
  error?: string;
}

const SYSTEM_PROMPT = `你是一个专业的软件工程师 Agent。你会收到一个具体的编码任务规格（task spec），需要在给定的代码库中完成实现。

工作方式：
1. 先用 list_dir 和 read_file 了解代码库结构和相关文件
2. 制定实现计划，然后逐步用 write_file 写代码
3. 用 bash_exec 运行测试或类型检查验证实现正确性
4. 如果有错误，读取错误信息并修复
5. 所有工作完成后用 git_commit 提交，然后调用 task_done 结束

规则：
- 严格按照 task spec 的要求实现，不添加额外功能
- 代码风格必须与已有代码一致
- 完成前必须确保测试通过（如果代码库有测试）
- commit message 使用中文，简洁描述做了什么`;

export async function runKimiAgent(
  repoRoot: string,
  branchName: string,
  taskSpec: string
): Promise<AgentResult> {
  // 切换到指定分支
  gitCreateBranch(repoRoot, branchName);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `代码库路径：${repoRoot}\n分支：${branchName}\n\n任务规格：\n${taskSpec}`,
    },
  ];

  const tools = getSandboxToolDefinitions();
  let steps = 0;
  let finalSummary = "";

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

    // 没有工具调用，说明 Kimi 认为完成了（但没调 task_done）
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      finalSummary = assistantMsg.content ?? "任务完成（无摘要）";
      break;
    }

    // 执行所有 tool calls，每个结果单独作为一条 tool message 加入对话
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

  const diff = gitDiff(repoRoot, "main");

  return {
    success: true,
    summary: finalSummary || `Kimi 在 ${steps} 步内完成任务`,
    diff: diff || "[无文件变更]",
    steps,
  };
}
