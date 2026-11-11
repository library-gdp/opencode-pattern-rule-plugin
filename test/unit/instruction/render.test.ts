import { describe, expect, it } from "vitest";
import type { Instruction } from "../../../src/instruction/parse.js";
import { renderInstruction } from "../../../src/instruction/render.js";

const apiInstruction: Instruction = {
  source: ".opencode/conditional-instructions/api.md",
  paths: ["src/api/**/*.ts"],
  sessionStart: true,
  body: "# API 지침\n- 모든 handler는 zod로 입력을 검증한다.",
};

describe("renderInstruction", () => {
  // FR-3. 출처와 지침을 켠 파일 경로를 함께 표시
  describe("given: 크기 상한보다 작은 지침", () => {
    describe("when: src/api/users.ts 접근으로 렌더링하면", () => {
      const { text } = renderInstruction(apiInstruction, { triggeredBy: "src/api/users.ts", maxBytes: 8 * 1024 });

      it("then: 지침 출처, 지침을 켠 파일, 본문을 모두 담는다", () => {
        expect(text).toContain(".opencode/conditional-instructions/api.md");
        expect(text).toContain("src/api/users.ts");
        expect(text).toContain("- 모든 handler는 zod로 입력을 검증한다.");
      });
    });
  });

  // NFR-3. 크기 상한을 넘으면 잘라내고 경고
  describe("given: 본문이 크기 상한(maxBytes)을 넘는 지침", () => {
    const longInstruction: Instruction = { ...apiInstruction, body: "x".repeat(100) };

    describe("when: 렌더링하면", () => {
      const { text, warnings } = renderInstruction(longInstruction, { triggeredBy: "src/api/users.ts", maxBytes: 10 });

      it("then: 본문을 상한까지 잘라낸다", () => {
        expect(text).toContain("x".repeat(10));
        expect(text).not.toContain("x".repeat(11));
      });

      it("then: 경고를 하나 돌려준다", () => {
        expect(warnings).toHaveLength(1);
      });
    });
  });
});
