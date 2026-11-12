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

describe("loadInstructions", () => {
  // FR-1. 지침 파일 위치
  it("global: true면 프로젝트와 전역 위치의 .md 파일을 하위 디렉터리까지 읽는다", async () => {
    // Given
    writeFile(worktree, ".opencode/conditional-instructions/api.md", '---\npaths: "src/api/**"\n---\nAPI');
    writeFile(worktree, ".opencode/conditional-instructions/nested/db.md", '---\npaths: "src/db/**"\n---\nDB');
    writeFile(configDir, "conditional-instructions/global.md", "전역");

    // When
    const { instructions } = await loadInstructions({ worktree, configDir, global: true });

    // Then
    expect(bodies(instructions)).toEqual(["API", "DB", "전역"]);
  });

  it("global: false면 프로젝트 위치의 파일만 읽는다", async () => {
    // Given
    writeFile(worktree, ".opencode/conditional-instructions/api.md", "API");
    writeFile(configDir, "conditional-instructions/global.md", "전역");

    // When
    const { instructions } = await loadInstructions({ worktree, configDir, global: false });

    // Then
    expect(bodies(instructions)).toEqual(["API"]);
  });

  // FR-8. 지침 변경 반영
  it("한 번 읽은 뒤 수정·추가한 지침 파일을 다시 읽으면 반영한다", async () => {
    // Given
    writeFile(worktree, ".opencode/conditional-instructions/api.md", "v1");
    await loadInstructions({ worktree, configDir, global: false });
    writeFile(worktree, ".opencode/conditional-instructions/api.md", "v2");
    writeFile(worktree, ".opencode/conditional-instructions/new.md", "new");

    // When
    const { instructions } = await loadInstructions({ worktree, configDir, global: false });

    // Then
    expect(bodies(instructions)).toEqual(["new", "v2"]);
  });
});
