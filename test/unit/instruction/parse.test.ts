import { describe, expect, it } from "vitest";
import { parseInstruction } from "../../../src/instruction/parse.js";

// FR-2. 지침 파일 형식: frontmatter(paths, sessionStart) + 본문
describe("parseInstruction", () => {
  describe("given: paths를 YAML 목록으로 적은 지침 파일", () => {
    const source = ".opencode/conditional-instructions/api.md";
    const text = [
      "---",
      "paths:",
      '  - "src/api/**/*.ts"',
      '  - "src/**/*.{test,spec}.ts"',
      "---",
      "",
      "# API 지침",
      "- 모든 handler는 zod로 입력을 검증한다.",
    ].join("\n");

    describe("when: 파싱하면", () => {
      const instruction = parseInstruction({ source, text });

      it("then: 출처, paths 목록, 기본 sessionStart(true), 본문을 돌려준다", () => {
        expect(instruction).toEqual({
          source,
          paths: ["src/api/**/*.ts", "src/**/*.{test,spec}.ts"],
          sessionStart: true,
          body: "# API 지침\n- 모든 handler는 zod로 입력을 검증한다.",
        });
      });
    });
  });

  describe("given: paths를 쉼표로 구분한 문자열로 적은 지침 파일", () => {
    const text = '---\npaths: "src/a/**, src/b/**"\n---\n본문';

    describe("when: 파싱하면", () => {
      const instruction = parseInstruction({ source: "a.md", text });

      it("then: paths를 목록으로 나눠 돌려준다", () => {
        expect(instruction.paths).toEqual(["src/a/**", "src/b/**"]);
      });
    });
  });

  describe("given: sessionStart: false를 적은 지침 파일", () => {
    const text = '---\npaths: ["src/**"]\nsessionStart: false\n---\n본문';

    describe("when: 파싱하면", () => {
      const instruction = parseInstruction({ source: "a.md", text });

      it("then: sessionStart가 false다", () => {
        expect(instruction.sessionStart).toBe(false);
      });
    });
  });

  describe("given: frontmatter가 없는 지침 파일", () => {
    const text = "# 항상 지침";

    describe("when: 파싱하면", () => {
      const instruction = parseInstruction({ source: "always.md", text });

      it("then: paths가 빈 항상 적용 지침을 돌려준다", () => {
        expect(instruction).toEqual({ source: "always.md", paths: [], sessionStart: true, body: "# 항상 지침" });
      });
    });
  });
});
