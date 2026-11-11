import { describe, expect, it } from "vitest";
import { globBase, matchesGlob } from "../../../src/matching/glob.js";

// FR-2. 중괄호 확장과 dot 파일 매칭
describe("matchesGlob", () => {
  describe.each([
    ["src/api/**/*.ts", "src/api/users/handler.ts"],
    ["src/**/*.{test,spec}.ts", "src/a/b.test.ts"],
    ["src/**/*.{test,spec}.ts", "src/a/b.spec.ts"],
    ["**/*.ts", "src/.hidden/config.ts"],
    ["**/*.json", ".eslintrc.json"],
  ])("given: glob %s 와 파일 %s", (pattern, file) => {
    describe("when: 매칭하면", () => {
      it("then: 일치한다", () => {
        expect(matchesGlob(pattern, file)).toBe(true);
      });
    });
  });
});

// FR-5. glob의 고정 접두부(base)
describe("globBase", () => {
  describe.each([
    ["src/api/**/*.ts", "src/api"],
    ["src/api/handler.ts", "src/api/handler.ts"],
    ["src/*/index.ts", "src"],
    ["**/*.ts", ""],
  ])("given: glob %s", (pattern, base) => {
    describe("when: base를 구하면", () => {
      it(`then: '${base}'를 돌려준다`, () => {
        expect(globBase(pattern)).toBe(base);
      });
    });
  });
});
