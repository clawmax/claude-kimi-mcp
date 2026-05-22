import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

function assertSafe(repoRoot: string, filePath: string): string {
  const abs = path.resolve(repoRoot, filePath);
  if (!abs.startsWith(path.resolve(repoRoot))) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  return abs;
}

export function readFile(repoRoot: string, filePath: string): string {
  const abs = assertSafe(repoRoot, filePath);
  if (!fs.existsSync(abs)) return `[File not found: ${filePath}]`;
  const content = fs.readFileSync(abs, "utf-8");
  const lines = content.split("\n");
  if (lines.length > 200) {
    return (
      lines.slice(0, 200).join("\n") +
      `\n... [truncated — ${lines.length} lines total. Use read_file_range to read more.]`
    );
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
  if (!fs.existsSync(abs)) return `[File not found: ${filePath}]`;
  const lines = fs.readFileSync(abs, "utf-8").split("\n");
  return lines.slice(startLine - 1, endLine).join("\n");
}

export function writeFile(repoRoot: string, filePath: string, content: string): string {
  const abs = assertSafe(repoRoot, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return `Written: ${filePath}`;
}

export function listDir(repoRoot: string, dirPath: string = "."): string {
  const abs = assertSafe(repoRoot, dirPath);
  if (!fs.existsSync(abs)) return `[Directory not found: ${dirPath}]`;
  try {
    const out = execSync(
      `find "${abs}" -maxdepth 2 -not -path "*/node_modules/*" -not -path "*/.git/*" | head -60`,
      { encoding: "utf-8" }
    );
    return out.trim();
  } catch (e: any) {
    return e.message;
  }
}

export function bashExec(repoRoot: string, command: string, timeoutMs = 30000): string {
  const blocked = ["rm -rf", "git push", "git reset --hard", "sudo", "curl", "wget", "npm publish"];
  for (const b of blocked) {
    if (command.includes(b)) {
      return `[Blocked: command contains forbidden operation "${b}"]`;
    }
  }
  try {
    const out = execSync(command, {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out.trim() || "[Command succeeded with no output]";
  } catch (e: any) {
    return `[Error]\nstdout: ${e.stdout || ""}\nstderr: ${e.stderr || ""}\nmessage: ${e.message}`;
  }
}

export function gitStatus(repoRoot: string): string {
  return bashExec(repoRoot, "git status --short");
}

export function gitDiff(repoRoot: string, base = "HEAD"): string {
  const diff = bashExec(repoRoot, `git diff ${base}`);
  if (diff.length > 8000) {
    return diff.slice(0, 8000) + "\n... [diff truncated]";
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

export function getSandboxToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "read_file",
        description: "Read a file from the repository",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Path relative to the repo root" },
          },
          required: ["file_path"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "read_file_range",
        description: "Read a specific line range from a file",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            start_line: { type: "number", description: "Start line (1-indexed)" },
            end_line: { type: "number", description: "End line (inclusive)" },
          },
          required: ["file_path", "start_line", "end_line"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "write_file",
        description: "Write or overwrite a file with the given content",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            content: { type: "string", description: "Full file content to write" },
          },
          required: ["file_path", "content"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "list_dir",
        description: "List directory structure (max 2 levels, excludes node_modules and .git)",
        parameters: {
          type: "object",
          properties: {
            dir_path: { type: "string", description: "Directory path, defaults to repo root" },
          },
          required: [],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "bash_exec",
        description: "Execute a shell command in the repo root (e.g. run tests, type-check)",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "Shell command to execute" },
          },
          required: ["command"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_status",
        description: "Show current git working tree status",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_diff",
        description: "Show the current uncommitted diff",
        parameters: {
          type: "object",
          properties: {
            base: { type: "string", description: "Diff base, defaults to HEAD" },
          },
          required: [],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "git_commit",
        description: "Stage all changes (git add -A) and create a commit",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Commit message" },
          },
          required: ["message"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "task_done",
        description: "Signal task completion and return a summary of the work done",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Summary of completed work" },
          },
          required: ["summary"],
        },
      },
    },
  ];
}

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
      return `__TASK_DONE__:${args.summary}`;
    default:
      return `[Unknown tool: ${toolName}]`;
  }
}
