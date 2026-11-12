import { describe, expect, it } from "vitest";
import { parseInstruction } from "../../../src/instruction/parse.js";

// FR-2. 지침 파일 형식: frontmatter(paths, sessionStart) + 본문
describe("parseInstruction", () => {
  it("YAML 목록으로 적은 paths와 본문을 읽고 sessionStart는 기본값 true로 둔다", () => {
    // Given
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

    // When
    const instruction = parseInstruction({ source, text });

    // Then
    expect(instruction).toEqual({
      source,
      paths: ["src/api/**/*.ts", "src/**/*.{test,spec}.ts"],
      sessionStart: true,
      body: "# API 지침\n- 모든 handler는 zod로 입력을 검증한다.",
    });
  });

  it("쉼표로 구분한 문자열 paths를 목록으로 나눈다", () => {
    // Given
    const text = '---\npaths: "src/a/**, src/b/**"\n---\n본문';

    // When
    const instruction = parseInstruction({ source: "a.md", text });

    // Then
    expect(instruction.paths).toEqual(["src/a/**", "src/b/**"]);
  });

  it("sessionStart: false를 읽는다", () => {
    // Given
    const text = '---\npaths: ["src/**"]\nsessionStart: false\n---\n본문';

    // When
    const instruction = parseInstruction({ source: "a.md", text });

    // Then
    expect(instruction.sessionStart).toBe(false);
  });

  it("frontmatter가 없으면 paths가 빈 항상 적용 지침이 된다", () => {
    // Given
    const text = "# 항상 지침";

    // When
    const instruction = parseInstruction({ source: "always.md", text });

    // Then
    expect(instruction).toEqual({ source: "always.md", paths: [], sessionStart: true, body: "# 항상 지침" });
  });
});
