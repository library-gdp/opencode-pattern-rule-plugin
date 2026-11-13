import { describe, expect, it } from "vitest";
import type { Instruction } from "../../../src/instruction/parse.js";
import { renderInstruction } from "../../../src/instruction/render.js";

const apiInstruction: Instruction = {
  source: ".opencode/conditional-instructions/api.md",
  paths: ["src/api/**/*.ts"],
  body: "# API 지침\n- 모든 handler는 zod로 입력을 검증한다.",
};

describe("renderInstruction", () => {
  // FR-3. 출처와 지침을 켠 파일 경로를 함께 표시
  it("지침 출처, 지침을 켠 파일, 본문을 모두 담는다", () => {
    // Given
    const options = { triggeredBy: "src/api/users.ts", maxBytes: 8 * 1024 };

    // When
    const { text } = renderInstruction(apiInstruction, options);

    // Then
    expect(text).toContain(".opencode/conditional-instructions/api.md");
    expect(text).toContain("src/api/users.ts");
    expect(text).toContain("- 모든 handler는 zod로 입력을 검증한다.");
  });

  // NFR-3. 크기 상한을 넘으면 잘라내고 경고
  it("본문이 maxBytes를 넘으면 상한까지 잘라내고 경고를 돌려준다", () => {
    // Given
    const longInstruction: Instruction = { ...apiInstruction, body: "x".repeat(100) };

    // When
    const { text, warnings } = renderInstruction(longInstruction, { triggeredBy: "src/api/users.ts", maxBytes: 10 });

    // Then
    expect(text).toContain("x".repeat(10));
    expect(text).not.toContain("x".repeat(11));
    expect(warnings).toHaveLength(1);
  });
});
