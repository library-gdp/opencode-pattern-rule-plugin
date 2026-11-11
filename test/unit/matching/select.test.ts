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
  describe("given: api, tests, 항상 적용 지침이 있다", () => {
    const instructions = [api, tests, always];

    describe("when: src/api/users.test.ts 경로로 고르면", () => {
      const selected = selectForFile(instructions, "src/api/users.test.ts");

      it("then: 경로와 일치하는 api, tests 지침을 고른다", () => {
        expect(selected).toEqual([api, tests]);
      });
    });
  });
});

// FR-4. 항상 적용 지침
describe("selectAlwaysApplied", () => {
  describe("given: paths가 있는 지침과 없는 지침이 있다", () => {
    const instructions = [api, always];

    describe("when: 항상 적용 지침을 고르면", () => {
      const selected = selectAlwaysApplied(instructions);

      it("then: paths가 없는 지침만 고른다", () => {
        expect(selected).toEqual([always]);
      });
    });
  });
});

// FR-5. 세션 시작 디렉터리 매칭
describe("selectForSessionStart", () => {
  describe("given: paths가 src/api/**/*.ts인 지침", () => {
    const instructions = [api];

    describe.each(["src/api", "src/api/v1"])("when: 세션 디렉터리가 %s 이면", (directory) => {
      it("then: base와 같거나 그 아래라 지침을 고른다", () => {
        expect(selectForSessionStart(instructions, directory)).toEqual([api]);
      });
    });

    describe.each(["src", ""])("when: 세션 디렉터리가 '%s' 이면", (directory) => {
      it("then: base보다 넓은 범위라 고르지 않는다", () => {
        expect(selectForSessionStart(instructions, directory)).toEqual([]);
      });
    });
  });

  describe("given: base가 빈 glob 지침, sessionStart: false 지침, src/api 지침", () => {
    const instructions = [anyTs, optedOut, api];

    describe("when: 세션 디렉터리가 src/api 이면", () => {
      const selected = selectForSessionStart(instructions, "src/api");

      it("then: src/api 지침만 고른다", () => {
        expect(selected).toEqual([api]);
      });
    });
  });
});
