import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { detectBaseBranch } from "../agent-loop.js";
import { formatResult } from "../index.js";
import type { AgentResult } from "../agent-loop.js";

describe("formatResult — 成功结果格式", () => {
  const successResult: AgentResult = {
    success: true,
    summary: "Implemented rate limiting",
    diff: "+ added 10 lines",
    steps: 5,
    fallback_needed: false,
  };

  test("包含 branch 名", () => {
    const output = formatResult("feature/rate-limit", successResult);
    expect(output.content[0].text).toContain("feature/rate-limit");
  });

  test("包含步骤数", () => {
    const output = formatResult("feature/rate-limit", successResult);
    expect(output.content[0].text).toContain("5");
  });

  test("包含 diff 内容", () => {
    const output = formatResult("feature/rate-limit", successResult);
    expect(output.content[0].text).toContain("added 10 lines");
  });

  test("成功时 status 显示 success", () => {
    const output = formatResult("feature/rate-limit", successResult);
    expect(output.content[0].text).toContain("success");
  });

  test("部分成功时 status 包含 partial", () => {
    const partial: AgentResult = { ...successResult, success: false };
    const output = formatResult("feature/rate-limit", partial);
    expect(output.content[0].text).toContain("partial");
  });
});

describe("formatResult — fallback_needed 结果格式", () => {
  const fallbackResult: AgentResult = {
    success: false,
    summary: "No changes produced",
    diff: "",
    steps: 3,
    fallback_needed: true,
  };

  test("返回 JSON 字符串且包含 fallback_needed:true", () => {
    const output = formatResult("feature/x", fallbackResult);
    const parsed = JSON.parse(output.content[0].text);
    expect(parsed.fallback_needed).toBe(true);
  });

  test("fallback JSON 包含 branch 名", () => {
    const output = formatResult("feature/x", fallbackResult);
    const parsed = JSON.parse(output.content[0].text);
    expect(parsed.branch).toBe("feature/x");
  });

  test("fallback JSON 包含 last_attempt_summary", () => {
    const output = formatResult("feature/x", fallbackResult);
    const parsed = JSON.parse(output.content[0].text);
    expect(parsed.last_attempt_summary).toBe("No changes produced");
  });
});

describe("detectBaseBranch", () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-branch-test-"));
    execFileSync("git", ["init"], { cwd: repoDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: repoDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoDir });
    // 创建一个初始提交，否则 git rev-parse 无法解析任何分支名
    fs.writeFileSync(path.join(repoDir, "readme.txt"), "init");
    execFileSync("git", ["add", "."], { cwd: repoDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir });
  });

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  test("默认分支为 master 时返回 master", () => {
    // git init 默认创建 master（老版本）或 main（新版本）
    const result = detectBaseBranch(repoDir);
    expect(["main", "master"]).toContain(result);
  });

  test("存在 main 分支时返回 main（优先于 master）", () => {
    // 重命名当前分支为 main
    try {
      execFileSync("git", ["branch", "-m", "main"], { cwd: repoDir });
    } catch {
      // 已经叫 main
    }
    const result = detectBaseBranch(repoDir);
    expect(result).toBe("main");
  });

  test("无常见分支时回退到 HEAD", () => {
    // 重命名为非常规名字
    execFileSync("git", ["branch", "-m", "custom-default"], { cwd: repoDir });
    const result = detectBaseBranch(repoDir);
    expect(result).toBe("HEAD");
  });
});
