import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  readFile,
  readFileRange,
  writeFile,
  listDir,
  bashExec,
  gitCreateBranch,
  executeSandboxTool,
} from "../sandbox-tools.js";

describe("路径穿越防护", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-sandbox-test-"));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test("readFile 拦截 ../.. 路径穿越", () => {
    expect(() => readFile(repoRoot, "../../etc/passwd")).toThrow("Path traversal detected");
  });

  test("readFile 拦截绝对路径逃出 repoRoot", () => {
    expect(() => readFile(repoRoot, "/etc/passwd")).toThrow("Path traversal detected");
  });

  test("writeFile 拦截路径穿越", () => {
    expect(() => writeFile(repoRoot, "../../tmp/evil.txt", "pwned")).toThrow("Path traversal detected");
  });

  test("readFile 正常读取 repoRoot 内的文件", () => {
    fs.writeFileSync(path.join(repoRoot, "hello.txt"), "world");
    expect(readFile(repoRoot, "hello.txt")).toBe("world");
  });

  test("readFile 文件不存在时返回提示而非抛出", () => {
    const result = readFile(repoRoot, "nonexistent.txt");
    expect(result).toContain("[File not found");
  });

  test("readFile 超过 200 行时截断并提示", () => {
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i + 1}`).join("\n");
    fs.writeFileSync(path.join(repoRoot, "big.txt"), lines);
    const result = readFile(repoRoot, "big.txt");
    expect(result).toContain("truncated");
    expect(result.split("\n").length).toBeLessThanOrEqual(202); // 200行 + 1截断提示行
  });

  test("readFileRange 读取指定行范围", () => {
    fs.writeFileSync(path.join(repoRoot, "lines.txt"), "a\nb\nc\nd\ne");
    expect(readFileRange(repoRoot, "lines.txt", 2, 4)).toBe("b\nc\nd");
  });

  test("writeFile 自动创建父目录", () => {
    writeFile(repoRoot, "subdir/nested/file.txt", "content");
    expect(fs.readFileSync(path.join(repoRoot, "subdir/nested/file.txt"), "utf-8")).toBe("content");
  });
});

describe("bashExec 命令黑名单", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-bash-test-"));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test("拦截 rm -rf 命令", () => {
    const result = bashExec(repoRoot, "rm -rf /tmp/test");
    expect(result).toContain("[Blocked");
    expect(result).toContain("rm -rf");
  });

  test("拦截 git push 命令", () => {
    const result = bashExec(repoRoot, "git push origin main");
    expect(result).toContain("[Blocked");
  });

  test("拦截 git reset --hard 命令", () => {
    const result = bashExec(repoRoot, "git reset --hard HEAD");
    expect(result).toContain("[Blocked");
  });

  test("拦截 sudo 命令", () => {
    const result = bashExec(repoRoot, "sudo apt-get update");
    expect(result).toContain("[Blocked");
  });

  test("拦截 curl 命令", () => {
    const result = bashExec(repoRoot, "curl https://example.com");
    expect(result).toContain("[Blocked");
  });

  test("拦截 wget 命令", () => {
    const result = bashExec(repoRoot, "wget https://example.com");
    expect(result).toContain("[Blocked");
  });

  test("拦截 npm publish 命令", () => {
    const result = bashExec(repoRoot, "npm publish");
    expect(result).toContain("[Blocked");
  });

  test("正常执行安全命令", () => {
    const result = bashExec(repoRoot, "echo hello");
    expect(result).toBe("hello");
  });

  test("命令失败时返回错误信息而非抛出", () => {
    const result = bashExec(repoRoot, "cat nonexistent_file_xyz.txt");
    expect(result).toContain("[Error]");
  });
});

describe("gitCreateBranch 分支名校验", () => {
  test("拦截包含分号的分支名（命令注入）", () => {
    const result = gitCreateBranch("/tmp", "feat; rm -rf /");
    expect(result).toContain("[Blocked");
    expect(result).toContain("invalid branch name");
  });

  test("拦截包含空格的分支名", () => {
    const result = gitCreateBranch("/tmp", "my feature branch");
    expect(result).toContain("[Blocked");
  });

  test("拦截包含 $ 的分支名", () => {
    const result = gitCreateBranch("/tmp", "feat/$(whoami)");
    expect(result).toContain("[Blocked");
  });

  test("合法分支名通过校验（feat/my-feature）", () => {
    // 不在真实 git repo 里，会报 git 错误，但不应该报"invalid branch name"
    const result = gitCreateBranch("/tmp", "feat/my-feature");
    expect(result).not.toContain("invalid branch name");
  });

  test("合法分支名通过校验（fix/issue-123）", () => {
    const result = gitCreateBranch("/tmp", "fix/issue-123");
    expect(result).not.toContain("invalid branch name");
  });
});

describe("executeSandboxTool 工具分发", () => {
  test("未知工具名返回提示字符串", () => {
    const result = executeSandboxTool("/tmp", "unknown_tool_xyz", {});
    expect(result).toBe("[Unknown tool: unknown_tool_xyz]");
  });

  test("task_done 返回 __TASK_DONE__ 前缀的字符串", () => {
    const result = executeSandboxTool("/tmp", "task_done", { summary: "all done" });
    expect(result).toBe("__TASK_DONE__:all done");
  });
});
