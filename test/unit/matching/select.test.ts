import { describe, expect, it } from "vitest";
import type { Instruction } from "../../../src/instruction/parse.js";
import { selectAlwaysApplied, selectForFile, selectForSessionStart } from "../../../src/matching/select.js";

function instruction(source: string, paths: string[], sessionStart = true): Instruction {
  return { source, paths, sessionStart, body: `${source} 본문` };
}

const api = instruction("api.md", ["src/api/**/*.ts"]);
const tests = instruction("tests.md", ["src/**/*.{test,spec}.ts"]);
const anyTs = instruction("any-ts.md", ["**/*.ts"]);
const optedOut = instruction("opted-out.md", ["src/api/**"], false);
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

// FR-5. 세션 시작 디렉터리 매칭
describe("selectForSessionStart", () => {
  it.each(["src/api", "src/api/v1"])("세션 디렉터리 %s 는 glob base와 같거나 그 아래라 지침을 고른다", (directory) => {
    // Given
    const instructions = [api];

    // When
    const selected = selectForSessionStart(instructions, directory);

    // Then
    expect(selected).toEqual([api]);
  });

  it.each(["src", ""])("세션 디렉터리 '%s' 는 glob base보다 넓은 범위라 고르지 않는다", (directory) => {
    // Given
    const instructions = [api];

    // When
    const selected = selectForSessionStart(instructions, directory);

    // Then
    expect(selected).toEqual([]);
  });

  it("base가 빈 glob 지침과 sessionStart: false 지침은 고르지 않는다", () => {
    // Given
    const instructions = [anyTs, optedOut, api];

    // When
    const selected = selectForSessionStart(instructions, "src/api");

    // Then
    expect(selected).toEqual([api]);
  });
});
