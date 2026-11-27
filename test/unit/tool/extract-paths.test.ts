import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, type Options } from "../../../src/options.js";
import { extractToolPaths } from "../../../src/tool/extract-paths.js";

const projectDir = "/repo";
const defaultOptions: Options = { ...DEFAULT_OPTIONS, customTools: {} };

// FR-3. 도구별로 접근한 파일 경로를 프로젝트 디렉터리 기준 상대 경로로 뽑는다
describe("extractToolPaths", () => {
  it.each(["read", "edit", "write"])("%s 도구의 filePath를 상대 경로로 돌려준다", (tool) => {
    // Given
    const call = { tool, args: { filePath: "/repo/src/a.ts" } };

    // When
    const paths = extractToolPaths(call, { projectDir, options: defaultOptions });

    // Then
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("프로젝트 디렉터리 밖의 파일은 절대 경로로 돌려준다", () => {
    // Given
    const call = { tool: "read", args: { filePath: "/etc/nginx/nginx.conf" } };

    // When
    const paths = extractToolPaths(call, { projectDir, options: defaultOptions });

    // Then
    expect(paths).toEqual(["/etc/nginx/nginx.conf"]);
  });

  it("상대 경로로 프로젝트 디렉터리 밖을 가리키면 절대 경로로 돌려준다", () => {
    // Given
    const call = { tool: "read", args: { filePath: "../other/a.ts" } };

    // When
    const paths = extractToolPaths(call, { projectDir, options: defaultOptions });

    // Then
    expect(paths).toEqual(["/other/a.ts"]);
  });

  it.each([
    ["C:\\repo\\src\\a.ts", "src/a.ts"],
    ["C:/repo/src/a.ts", "src/a.ts"],
    ["c:\\Repo\\src\\a.ts", "src/a.ts"],
    ["src\\a.ts", "src/a.ts"],
    ["D:\\notes\\todo.md", "D:/notes/todo.md"],
    ["\\\\server\\share\\a.md", "//server/share/a.md"],
  ])("Windows 프로젝트에서 %s 는 %s 로 돌려준다", (filePath, expected) => {
    // Given
    const call = { tool: "read", args: { filePath } };

    // When
    const paths = extractToolPaths(call, { projectDir: "C:\\repo", options: defaultOptions });

    // Then
    expect(paths).toEqual([expected]);
  });

  it("apply_patch 도구는 패치에 포함된 모든 파일을 돌려준다", () => {
    // Given
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
    const call = { tool: "apply_patch", args: { patchText } };

    // When
    const paths = extractToolPaths(call, { projectDir, options: defaultOptions });

    // Then
    expect(paths).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it.each(["cat src/a.ts", "head -n 20 src/a.ts", "tail /repo/src/a.ts", "less src/a.ts"])(
    "bash 도구의 `%s`는 읽은 파일을 돌려준다",
    (command) => {
      // Given
      const call = { tool: "bash", args: { command } };

      // When
      const paths = extractToolPaths(call, { projectDir, options: defaultOptions });

      // Then
      expect(paths).toEqual(["src/a.ts"]);
    },
  );

  it("searchTools를 켜면 grep 도구의 탐색 경로를 돌려준다", () => {
    // Given
    const options = { ...defaultOptions, searchTools: true };
    const call = { tool: "grep", args: { pattern: "TODO", path: "/repo/src/api" } };

    // When
    const paths = extractToolPaths(call, { projectDir, options });

    // Then
    expect(paths).toEqual(["src/api"]);
  });

  it("customTools에 등록한 도구는 등록한 인자의 경로만 돌려준다", () => {
    // Given
    const options = { ...defaultOptions, customTools: { mcp_read: ["file"] } };
    const call = { tool: "mcp_read", args: { file: "src/a.ts", other: "src/b.ts" } };

    // When
    const paths = extractToolPaths(call, { projectDir, options });

    // Then
    expect(paths).toEqual(["src/a.ts"]);
  });
});
