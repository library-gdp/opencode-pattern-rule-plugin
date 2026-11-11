import { beforeEach, describe, expect, it } from "vitest";
import { SessionTracker } from "../../../src/session/tracker.js";

// FR-6. 세션 단위 중복 방지 / FR-7. compaction 이후 유지
describe("SessionTracker", () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    tracker = new SessionTracker();
  });

  describe("given: 세션 s1에서 api.md를 아직 적용하지 않았다", () => {
    describe("when: s1에서 api.md를 claim하면", () => {
      it("then: true를 돌려준다", () => {
        expect(tracker.claim("s1", "api.md")).toBe(true);
      });
    });
  });

  describe("given: 세션 s1에서 api.md를 이미 claim했다", () => {
    beforeEach(() => {
      tracker.claim("s1", "api.md");
    });

    describe("when: 같은 세션에서 다시 claim하면", () => {
      it("then: false를 돌려준다", () => {
        expect(tracker.claim("s1", "api.md")).toBe(false);
      });
    });

    describe("when: 서브에이전트 세션 s1-child에서 claim하면", () => {
      it("then: 별도 세션이라 true를 돌려준다", () => {
        expect(tracker.claim("s1-child", "api.md")).toBe(true);
      });
    });
  });

  describe("given: s1에서 api.md, tests.md를, s2에서 other.md를 claim했다", () => {
    beforeEach(() => {
      tracker.claim("s1", "api.md");
      tracker.claim("s1", "tests.md");
      tracker.claim("s2", "other.md");
    });

    describe("when: s1에 적용한 지침을 조회하면", () => {
      it("then: s1에서 claim한 지침만 순서대로 돌려준다", () => {
        expect(tracker.applied("s1")).toEqual(["api.md", "tests.md"]);
      });
    });
  });
});
