import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, type Options } from "../../../src/options.js";
import { extractToolPaths } from "../../../src/tool/extract-paths.js";

const worktree = "/repo";
const defaultOptions: Options = { ...DEFAULT_OPTIONS, customTools: {} };

// FR-3. 도구별로 접근한 파일 경로를 worktree 기준 상대 경로로 뽑는다
describe("extractToolPaths", () => {
  describe("given: 기본 옵션", () => {
    const context = { worktree, options: defaultOptions };

    describe.each(["read", "edit", "write"])("when: %s 도구가 /repo/src/a.ts에 접근하면", (tool) => {
      it("then: src/a.ts를 돌려준다", () => {
        expect(extractToolPaths({ tool, args: { filePath: "/repo/src/a.ts" } }, context)).toEqual(["src/a.ts"]);
      });
    });

    describe("when: apply_patch 도구가 두 파일을 패치하면", () => {
      const patchText = [
        "*** Begin Patch",
        "*** Update File: src/a.ts",
        "@@",
        "-old",
        "+new",
        "*** Add File: src/b.ts",
        "+new file",
        "*** End Patch",
      ].join("\n");

      it("then: 패치에 포함된 모든 파일을 돌려준다", () => {
        expect(extractToolPaths({ tool: "apply_patch", args: { patchText } }, context)).toEqual(["src/a.ts", "src/b.ts"]);
      });
    });

    describe.each(["cat src/a.ts", "head -n 20 src/a.ts", "tail /repo/src/a.ts", "less src/a.ts"])(
      "when: bash 도구가 `%s`를 실행하면",
      (command) => {
        it("then: 읽은 파일 src/a.ts를 돌려준다", () => {
          expect(extractToolPaths({ tool: "bash", args: { command } }, context)).toEqual(["src/a.ts"]);
        });
      },
    );
  });

  describe("given: searchTools를 켠 옵션", () => {
    const context = { worktree, options: { ...defaultOptions, searchTools: true } };

    describe("when: grep 도구가 /repo/src/api를 탐색하면", () => {
      const args = { pattern: "TODO", path: "/repo/src/api" };

      it("then: 탐색 경로 src/api를 돌려준다", () => {
        expect(extractToolPaths({ tool: "grep", args }, context)).toEqual(["src/api"]);
      });
    });
  });

  describe("given: customTools에 mcp_read 도구의 file 인자를 등록한 옵션", () => {
    const context = { worktree, options: { ...defaultOptions, customTools: { mcp_read: ["file"] } } };

    describe("when: mcp_read 도구가 실행되면", () => {
      const args = { file: "src/a.ts", other: "src/b.ts" };

      it("then: 등록한 인자의 경로만 돌려준다", () => {
        expect(extractToolPaths({ tool: "mcp_read", args }, context)).toEqual(["src/a.ts"]);
      });
    });
  });
});
