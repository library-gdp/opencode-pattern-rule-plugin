import { describe, expect, it } from "vitest";
import { SessionTracker } from "../../../src/session/tracker.js";

// FR-6. 세션 단위 중복 방지 / FR-7. compaction 이후 유지
describe("SessionTracker", () => {
  it("세션에서 처음 적용하는 지침을 claim하면 true를 돌려준다", () => {
    // Given
    const tracker = new SessionTracker();

    // When
    const claimed = tracker.claim("s1", "api.md");

    // Then
    expect(claimed).toBe(true);
  });

  it("같은 세션에서 이미 claim한 지침을 다시 claim하면 false를 돌려준다", () => {
    // Given
    const tracker = new SessionTracker();
    tracker.claim("s1", "api.md");

    // When
    const claimed = tracker.claim("s1", "api.md");

    // Then
    expect(claimed).toBe(false);
  });

  it("서브에이전트 세션은 별도 세션이라 같은 지침도 claim할 수 있다", () => {
    // Given
    const tracker = new SessionTracker();
    tracker.claim("s1", "api.md");

    // When
    const claimed = tracker.claim("s1-child", "api.md");

    // Then
    expect(claimed).toBe(true);
  });

  it("세션에 적용한 지침을 claim한 순서대로 돌려준다", () => {
    // Given
    const tracker = new SessionTracker();
    tracker.claim("s1", "api.md");
    tracker.claim("s1", "tests.md");
    tracker.claim("s2", "other.md");

    // When
    const applied = tracker.applied("s1");

    // Then
    expect(applied).toEqual(["api.md", "tests.md"]);
  });
});
