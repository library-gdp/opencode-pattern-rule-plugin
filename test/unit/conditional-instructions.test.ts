import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConditionalInstructions } from "../../src/conditional-instructions.js";
import { DEFAULT_OPTIONS } from "../../src/options.js";

// 플러그인 hook이 위임하는 진입점. 각 hook에서 어떻게 쓰이는지를 표현한다.
//   tool.execute.after                   → onToolExecuted()   결과 output 뒤에 덧붙임
//   experimental.chat.system.transform   → systemInstructions() system 배열에 추가 (NFR-1: 세션 동안 고정)
//   experimental.session.compacting      → compactionContext() context 배열에 추가

let projectDir: string;
// OpenCode user scope 설정 디렉터리(~/.config/opencode)를 대신하는 임시 디렉터리
let configDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(path.join(tmpdir(), "ci-project-"));
  configDir = mkdtempSync(path.join(tmpdir(), "ci-config-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
});

function writeInstruction(name: string, text: string): void {
  const file = path.join(projectDir, ".opencode/conditional-instructions", name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** src/api/**\/*.ts 지침과 항상 적용 지침을 만든다. */
function writeApiAndAlwaysInstructions(): void {
  writeInstruction("api.md", '---\npaths:\n  - "src/api/**/*.ts"\n---\nAPI 지침');
  writeInstruction("always.md", "항상 지침");
}

function create() {
  return createConditionalInstructions({
    projectDir,
    configDir,
    options: { ...DEFAULT_OPTIONS, customTools: {} },
  });
}

function readCall(sessionID: string, relativePath: string) {
  return { sessionID, tool: "read", args: { filePath: path.join(projectDir, relativePath) } };
}

describe("onToolExecuted", () => {
  // FR-3
  it("접근한 파일과 일치하는 지침을 지침을 켠 파일 경로와 함께 돌려준다", async () => {
    // Given
    writeApiAndAlwaysInstructions();
    const engine = create();

    // When
    const appended = await engine.onToolExecuted(readCall("s1", "src/api/users.ts"));

    // Then
    expect(appended).toContain("API 지침");
    expect(appended).toContain("src/api/users.ts");
  });

  // FR-6
  it("같은 세션에서 이미 넣은 지침은 다시 넣지 않는다", async () => {
    // Given
    writeApiAndAlwaysInstructions();
    const engine = create();
    await engine.onToolExecuted(readCall("s1", "src/api/a.ts"));

    // When
    const appended = await engine.onToolExecuted(readCall("s1", "src/api/a.ts"));

    // Then
    expect(appended).toBe("");
  });
});

describe("systemInstructions", () => {
  // FR-4 + FR-3
  it("세션 시작 시에는 paths가 없는 지침만 넣고 paths가 있는 지침은 넣지 않는다", async () => {
    // Given
    writeApiAndAlwaysInstructions();
    const engine = create();

    // When
    const system = (await engine.systemInstructions("s1")).join("\n");

    // Then
    expect(system).toContain("항상 지침");
    expect(system).not.toContain("API 지침");
  });

  // FR-3 + NFR-1
  it("paths가 있는 지침은 일치하는 파일에 접근할 때 넣고 system 지침은 바뀌지 않는다", async () => {
    // Given
    writeApiAndAlwaysInstructions();
    const engine = create();
    const before = await engine.systemInstructions("s1");

    // When
    const appended = await engine.onToolExecuted(readCall("s1", "src/api/a.ts"));

    // Then
    expect(appended).toContain("API 지침");
    expect(appended).not.toContain("항상 지침");
    expect(await engine.systemInstructions("s1")).toEqual(before);
  });
});

describe("compactionContext", () => {
  // FR-7
  it("세션에서 파일 접근으로 넣은 지침을 compaction context로 돌려준다", async () => {
    // Given
    writeApiAndAlwaysInstructions();
    const engine = create();
    await engine.onToolExecuted({ ...readCall("s1", "src/api/a.ts"), tool: "edit" });

    // When
    const context = (await engine.compactionContext("s1")).join("\n");

    // Then
    expect(context).toContain("API 지침");
  });
});
