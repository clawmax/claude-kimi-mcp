import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** 校验路径在允许的 repo 根目录内，防止路径穿越 */
function assertSafe(repoRoot: string, filePath: string): string {
  const abs = path.resolve(repoRoot, filePath);
  if (!abs.startsWith(path.resolve(repoRoot))) {
    throw new Error(`路径越界: ${filePath}`);
  }
  return abs;
}

export function readFile(repoRoot: string, filePath: string): string {
  const abs = assertSafe(repoRoot, filePath);
  if (!fs.existsSync(abs)) return `[文件不存在: ${filePath}]`;
  const content = fs.readFileSync(abs, "utf-8");
  // 超过 200 行只返回前 200 行，避免撑爆上下文
  const lines = content.split("\n");
  if (lines.length > 200) {
    return lines.slice(0, 200).join("\n") + `\n... [截断，共 ${lines.length} 行，请用 read_file_range 读取更多]`;
  }
  return content;
}

export function readFileRange(
  repoRoot: string,
  filePath: string,
  startLine: number,
  endLine: number
): string {
  const abs = assertSafe(repoRoot, filePath);
  if (!fs.existsSync(abs)) return `[文件不存在: ${filePath}]`;
  const lines = fs.readFileSync(abs, "utf-8").split("\n");
  return lines.slice(startLine - 1, endLine).join("\n");
}

export function writeFile(repoRoot: string, filePath: string, content: string): string {
  const abs = assertSafe(repoRoot, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return `已写入: ${filePath}`;
}

export function listDir(repoRoot: string, dirPath: string = "."): string {
  const abs = assertSafe(repoRoot, dirPath);
  if (!fs.existsSync(abs)) return `[目录不存在: ${dirPath}]`;
  try {
    const out = execSync(`find "${abs}" -maxdepth 2 -not -path "*/node_modules/*" -not -path "*/.git/*" | head -60`, {
      encoding: "utf-8",
    });
    return out.trim();
  } catch (e: any) {
    return e.message;
  }
}

export function bashExec(repoRoot: string, command: string, timeoutMs = 30000): string {
  // 禁止高危操作
  const blocked = ["rm -rf", "git push", "git reset --hard", "sudo", "curl", "wget", "npm publish"];
  for (const b of blocked) {
    if (command.includes(b)) {
      return `[拒绝执行: 命令包含禁止操作 "${b}"]`;
    }
  }
  try {
    const out = execSync(command, {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out.trim() || "[命令执行成功，无输出]";
  } catch (e: any) {
    return `[错误]\nstdout: ${e.stdout || ""}\nstderr: ${e.stderr || ""}\nmessage: ${e.message}`;
  }
}

export function gitStatus(repoRoot: string): string {
  return bashExec(repoRoot, "git status --short");
}

export function gitDiff(repoRoot: string, base = "HEAD"): string {
  const diff = bashExec(repoRoot, `git diff ${base}`);
  // 超过 8000 字符截断
  if (diff.length > 8000) {
    return diff.slice(0, 8000) + "\n... [diff 过长，已截断]";
  }
  return diff;
}

export function gitCreateBranch(repoRoot: string, branchName: string): string {
  return bashExec(repoRoot, `git checkout -b ${branchName} 2>&1 || git checkout ${branchName} 2>&1`);
}

export function gitCommit(repoRoot: string, message: string): string {
  bashExec(repoRoot, "git add -A");
  return bashExec(repoRoot, `git commit -m "${message.replace(/"/g, '\\"')}" 2>&1`);
}

/** 返回给 Kimi 的完整工具定义列表 */
export function getSandboxToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "read_file",
        description: "读取代码库中的文件内容",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "相对于 repo 根目录的文件路径" },
          },
          required: ["file_path"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "read_file_range",
        description: "读取文件的指定行范围",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            start_line: { type: "number", description: "起始行（1-indexed）" },
            end_line: { type: "number", description: "结束行（含）" },
          },
          required: ["file_path", "start_line", "end_line"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "write_file",
        description: "写入或覆盖文件内容",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            content: { type: "string", description: "完整文件内容" },
          },
          required: ["file_path", "content"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "list_dir",
        description: "列出目录结构（最多 2 层，排除 node_modules 和 .git）",
        parameters: {
          type: "object",
          properties: {
            dir_path: { type: "string", description: "目录路径，默认为根目录" },
          },
          required: [],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "bash_exec",
        description: "在 repo 根目录执行 shell 命令（如跑测试、编译检查）",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "要执行的命令" },
          },
          required: ["command"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_status",
        description: "查看当前 git 变更状态",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_diff",
        description: "查看当前未提交的 diff",
        parameters: {
          type: "object",
          properties: {
            base: { type: "string", description: "对比基准，默认 HEAD" },
          },
          required: [],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_commit",
        description: "将所有变更 git add 并提交",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "提交信息" },
          },
          required: ["message"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "task_done",
        description: "宣告任务完成，返回完成摘要",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "完成的工作摘要，供 Claude review 用" },
          },
          required: ["summary"],
        },
      },
    },
  ];
}

/** 执行 Kimi 返回的 tool call，返回结果字符串 */
export function executeSandboxTool(
  repoRoot: string,
  toolName: string,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case "read_file":
      return readFile(repoRoot, args.file_path as string);
    case "read_file_range":
      return readFileRange(repoRoot, args.file_path as string, args.start_line as number, args.end_line as number);
    case "write_file":
      return writeFile(repoRoot, args.file_path as string, args.content as string);
    case "list_dir":
      return listDir(repoRoot, (args.dir_path as string) || ".");
    case "bash_exec":
      return bashExec(repoRoot, args.command as string);
    case "git_status":
      return gitStatus(repoRoot);
    case "git_diff":
      return gitDiff(repoRoot, (args.base as string) || "HEAD");
    case "git_commit":
      return gitCommit(repoRoot, args.message as string);
    case "task_done":
      // 由调用方捕获，这里直接返回以便调用方识别终止信号
      return `__TASK_DONE__:${args.summary}`;
    default:
      return `[未知工具: ${toolName}]`;
  }
}
