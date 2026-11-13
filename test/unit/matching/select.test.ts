import { describe, expect, it } from "vitest";
import type { Instruction } from "../../../src/instruction/parse.js";
import { selectAlwaysApplied, selectForFile } from "../../../src/matching/select.js";

function instruction(source: string, paths: string[]): Instruction {
  return { source, paths, body: `${source} 본문` };
}

const api = instruction("api.md", ["src/api/**/*.ts"]);
const tests = instruction("tests.md", ["src/**/*.{test,spec}.ts"]);
const always = instruction("always.md", []);

// FR-3. 파일 접근 시 조건부 적용
describe("selectForFile", () => {
  it("프로젝트 디렉터리 기준 상대 경로와 일치하는 지침을 고른다", () => {
    // Given
    const instructions = [api, tests, always];

    // When
    const selected = selectForFile(instructions, "src/api/users.test.ts");

    // Then
    expect(selected).toEqual([api, tests]);
  });
});

// FR-4. 항상 적용 지침
describe("selectAlwaysApplied", () => {
  it("paths가 없는 지침만 고른다", () => {
    // Given
    const instructions = [api, always];

    // When
    const selected = selectAlwaysApplied(instructions);

    // Then
    expect(selected).toEqual([always]);
  });
});

