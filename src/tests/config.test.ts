import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadConfig } from "../cli.js";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".claude-kimi-mcp");
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, ".env");

describe("loadConfig", () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    // 清除相关环境变量
    delete process.env.KIMI_API_KEY;
    delete process.env.KIMI_BASE_URL;
    delete process.env.KIMI_MODEL;
    delete process.env.KIMI_MAX_STEPS;
    // 创建临时目录（模拟工作目录）
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-cfg-test-"));
  });

  afterEach(() => {
    // 恢复环境变量
    Object.assign(process.env, originalEnv);
    // 清理临时文件
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // 清理全局配置（如果测试写入了的话）
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const content = fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
      if (content.includes("test-from-global-file")) {
        fs.unlinkSync(GLOBAL_CONFIG_FILE);
      }
    }
  });

  test("从环境变量读取 KIMI_API_KEY（最高优先级）", async () => {
    process.env.KIMI_API_KEY = "sk-from-env";
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.apiKey).toBe("sk-from-env");
  });

  test("环境变量存在时跳过文件读取", async () => {
    process.env.KIMI_API_KEY = "sk-from-env";
    // 即使本地 .env 里有不同的 key，也应该用环境变量的
    fs.writeFileSync(path.join(tmpDir, ".env"), "KIMI_API_KEY=sk-from-local-file\n");
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.apiKey).toBe("sk-from-env");
  });

  test("无环境变量时回退到 ~/.claude-kimi-mcp/.env", async () => {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(GLOBAL_CONFIG_FILE, "KIMI_API_KEY=test-from-global-file\n");
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.apiKey).toBe("test-from-global-file");
  });

  test("无全局配置时回退到 ./.env", async () => {
    // 确保全局配置不存在（或不含此 key）
    const hadGlobal = fs.existsSync(GLOBAL_CONFIG_FILE);
    if (hadGlobal) {
      const orig = fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
      if (orig.includes("KIMI_API_KEY")) {
        // 全局配置存在且有 key，跳过此测试
        return;
      }
    }
    fs.writeFileSync(path.join(tmpDir, ".env"), "KIMI_API_KEY=sk-from-local\n");
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.apiKey).toBe("sk-from-local");
  });

  test("任何配置源都找不到 key 时抛出错误", async () => {
    await expect(loadConfig({ cwd: tmpDir })).rejects.toThrow("KIMI_API_KEY");
  });

  test("从环境变量读取 KIMI_BASE_URL", async () => {
    process.env.KIMI_API_KEY = "sk-test";
    process.env.KIMI_BASE_URL = "https://api.moonshot.ai/v1";
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.baseUrl).toBe("https://api.moonshot.ai/v1");
  });

  test("KIMI_BASE_URL 未设置时使用默认值", async () => {
    process.env.KIMI_API_KEY = "sk-test";
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.baseUrl).toBe("https://api.moonshot.cn/v1");
  });

  test("KIMI_MAX_STEPS 解析为整数", async () => {
    process.env.KIMI_API_KEY = "sk-test";
    process.env.KIMI_MAX_STEPS = "100";
    const config = await loadConfig({ cwd: tmpDir });
    expect(config.maxSteps).toBe(100);
  });
});
