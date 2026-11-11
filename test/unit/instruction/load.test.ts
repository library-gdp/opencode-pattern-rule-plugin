import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadInstructions } from "../../../src/instruction/load.js";

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

function writeFile(root: string, relative: string, text: string): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function bodies(instructions: { body: string }[]): string[] {
  return instructions.map((instruction) => instruction.body).sort();
}

// FR-1. 지침 파일 위치
describe("loadInstructions", () => {
  describe("given: 프로젝트 위치(하위 디렉터리 포함)와 전역 위치에 지침 파일이 있다", () => {
    beforeEach(() => {
      writeFile(worktree, ".opencode/conditional-instructions/api.md", '---\npaths: "src/api/**"\n---\nAPI');
      writeFile(worktree, ".opencode/conditional-instructions/nested/db.md", '---\npaths: "src/db/**"\n---\nDB');
      writeFile(configDir, "conditional-instructions/global.md", "전역");
    });

    describe("when: global: true로 읽으면", () => {
      it("then: 두 위치의 모든 .md 파일을 읽는다", async () => {
        const { instructions } = await loadInstructions({ worktree, configDir, global: true });

        expect(bodies(instructions)).toEqual(["API", "DB", "전역"]);
      });
    });

    describe("when: global: false로 읽으면", () => {
      it("then: 프로젝트 위치의 파일만 읽는다", async () => {
        const { instructions } = await loadInstructions({ worktree, configDir, global: false });

        expect(bodies(instructions)).toEqual(["API", "DB"]);
      });
    });
  });

  // FR-8. 지침 변경 반영
  describe("given: 한 번 읽은 뒤 지침 파일을 수정하고 새 파일을 추가했다", () => {
    beforeEach(async () => {
      writeFile(worktree, ".opencode/conditional-instructions/api.md", "v1");
      await loadInstructions({ worktree, configDir, global: false });

      writeFile(worktree, ".opencode/conditional-instructions/api.md", "v2");
      writeFile(worktree, ".opencode/conditional-instructions/new.md", "new");
    });

    describe("when: 다시 읽으면", () => {
      it("then: 수정·추가된 내용을 반영한다", async () => {
        const { instructions } = await loadInstructions({ worktree, configDir, global: false });

        expect(bodies(instructions)).toEqual(["new", "v2"]);
      });
    });
  });
});
