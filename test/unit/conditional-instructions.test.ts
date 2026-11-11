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

let worktree: string;
// OpenCode user scope 설정 디렉터리(~/.config/opencode)를 대신하는 임시 디렉터리
let configDir: string;

beforeEach(() => {
  worktree = mkdtempSync(path.join(tmpdir(), "ci-worktree-"));
  configDir = mkdtempSync(path.join(tmpdir(), "ci-config-"));
});

afterEach(() => {
  rmSync(worktree, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
});

function writeInstruction(name: string, text: string): void {
  const file = path.join(worktree, ".opencode/conditional-instructions", name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function givenInstructions(): void {
  writeInstruction("api.md", '---\npaths:\n  - "src/api/**/*.ts"\n---\nAPI 지침');
  writeInstruction("always.md", "항상 지침");
}

function create(sessionDirectory: string) {
  return createConditionalInstructions({
    worktree,
    configDir,
    options: { ...DEFAULT_OPTIONS, customTools: {} },
    sessionDirectory: async () => sessionDirectory,
  });
}

function readCall(sessionID: string, relativePath: string) {
  return { sessionID, tool: "read", args: { filePath: path.join(worktree, relativePath) } };
}

describe("onToolExecuted", () => {
  // FR-3
  describe("given: src/api/**/*.ts 지침이 있고 worktree 루트에서 시작한 세션", () => {
    beforeEach(givenInstructions);

    describe("when: src/api/users.ts를 처음 읽으면", () => {
      it("then: 지침 본문과 지침을 켠 파일 경로를 덧붙일 텍스트로 돌려준다", async () => {
        const appended = await create(worktree).onToolExecuted(readCall("s1", "src/api/users.ts"));

        expect(appended).toContain("API 지침");
        expect(appended).toContain("src/api/users.ts");
      });
    });
  });

  // FR-6
  describe("given: 세션 s1에서 src/api/a.ts를 읽어 지침을 이미 넣었다", () => {
    let engine: ReturnType<typeof create>;

    beforeEach(async () => {
      givenInstructions();
      engine = create(worktree);
      await engine.onToolExecuted(readCall("s1", "src/api/a.ts"));
    });

    describe("when: 같은 세션에서 같은 파일을 다시 읽으면", () => {
      it("then: 아무것도 덧붙이지 않는다", async () => {
        expect(await engine.onToolExecuted(readCall("s1", "src/api/a.ts"))).toBe("");
      });
    });
  });
});

describe("systemInstructions", () => {
  beforeEach(givenInstructions);

  // FR-4
  describe("given: worktree 루트에서 시작한 세션", () => {
    describe("when: system 지침을 구하면", () => {
      it("then: 항상 적용 지침만 넣는다", async () => {
        const system = (await create(worktree).systemInstructions("s1")).join("\n");

        expect(system).toContain("항상 지침");
        expect(system).not.toContain("API 지침");
      });
    });
  });

  // FR-5
  describe("given: src/api에서 시작한 세션", () => {
    describe("when: system 지침을 구하면", () => {
      it("then: 세션 디렉터리를 대상으로 하는 지침도 넣는다", async () => {
        const system = (await create(path.join(worktree, "src/api")).systemInstructions("s1")).join("\n");

        expect(system).toContain("API 지침");
      });
    });
  });

  // FR-6 + NFR-1
  describe("given: src/api에서 시작해 세션 시작 지침을 이미 넣은 세션", () => {
    let engine: ReturnType<typeof create>;
    let before: string[];

    beforeEach(async () => {
      engine = create(path.join(worktree, "src/api"));
      before = await engine.systemInstructions("s1");
    });

    describe("when: src/api/a.ts를 읽으면", () => {
      it("then: 같은 지침을 도구 결과에 다시 넣지 않는다", async () => {
        expect(await engine.onToolExecuted(readCall("s1", "src/api/a.ts"))).toBe("");
      });

      it("then: system 지침은 바뀌지 않는다", async () => {
        await engine.onToolExecuted(readCall("s1", "src/api/a.ts"));

        expect(await engine.systemInstructions("s1")).toEqual(before);
      });
    });
  });
});

describe("compactionContext", () => {
  // FR-7
  describe("given: 세션 s1에서 src/api/a.ts를 편집해 지침을 넣었다", () => {
    let engine: ReturnType<typeof create>;

    beforeEach(async () => {
      givenInstructions();
      engine = create(worktree);
      await engine.onToolExecuted({ ...readCall("s1", "src/api/a.ts"), tool: "edit" });
    });

    describe("when: compaction context를 구하면", () => {
      it("then: 적용 중이던 지침을 돌려준다", async () => {
        const context = (await engine.compactionContext("s1")).join("\n");

        expect(context).toContain("API 지침");
      });
    });
  });
});
