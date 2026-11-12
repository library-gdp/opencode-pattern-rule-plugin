import { describe, expect, it } from "vitest";
import { globBase, matchesGlob } from "../../../src/matching/glob.js";

// FR-2. 중괄호 확장과 dot 파일 매칭
describe("matchesGlob", () => {
  it.each([
    ["src/api/**/*.ts", "src/api/users/handler.ts"],
    ["src/**/*.{test,spec}.ts", "src/a/b.test.ts"],
    ["src/**/*.{test,spec}.ts", "src/a/b.spec.ts"],
    ["**/*.ts", "src/.hidden/config.ts"],
    ["**/*.json", ".eslintrc.json"],
  ])("glob %s 는 %s 와 일치한다", (pattern, file) => {
    // Given: pattern, file

    // When
    const matched = matchesGlob(pattern, file);

    // Then
    expect(matched).toBe(true);
  });
});

// FR-5. glob의 고정 접두부(base)
describe("globBase", () => {
  it.each([
    ["src/api/**/*.ts", "src/api"],
    ["src/api/handler.ts", "src/api/handler.ts"],
    ["src/*/index.ts", "src"],
    ["**/*.ts", ""],
  ])("glob %s 의 base는 '%s'다", (pattern, expected) => {
    // Given: pattern

    // When
    const base = globBase(pattern);

    // Then
    expect(base).toBe(expected);
  });
});
