import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import plugin from "../../src/index.js";

// 플러그인 진입점. OpenCode가 넘기는 PluginInput에서 어떤 경로를 기준으로 삼는지 확인한다.

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "ci-project-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("server", () => {
  it("git 저장소가 아니어서 worktree가 '/'여도 OpenCode를 실행한 디렉터리의 지침을 적용한다", async () => {
    // Given
    const file = path.join(directory, ".opencode/conditional-instructions/api.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '---\npaths: "src/api/**"\n---\nAPI 지침');
    const input = { client: {}, directory, worktree: "/" } as unknown as PluginInput;
    const hooks = await plugin.server(input, { global: false });
    const output = { title: "", output: "파일 내용", metadata: {} };

    // When
    await hooks["tool.execute.after"]!(
      { tool: "read", sessionID: "s1", callID: "c1", args: { filePath: path.join(directory, "src/api/a.ts") } },
      output,
    );

    // Then
    expect(output.output).toContain("API 지침");
    expect(output.output).toContain('source=".opencode/conditional-instructions/api.md"');
  });
});
