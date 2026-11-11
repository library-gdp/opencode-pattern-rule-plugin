import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언이 없는 .mjs 스크립트
import { fallbackConfigDir, parseArgs, parseDebugPaths, resolveConfigDir } from "../../scripts/opencode-install.mjs";

const DEBUG_PATHS = [
  "home       /home/u",
  "data       /home/u/.local/share/opencode",
  "config     /home/u/.config/opencode",
  "state      /home/u/.local/state/opencode",
].join("\n");

describe("parseDebugPaths", () => {
  it("config 줄의 경로를 돌려준다", () => {
    expect(parseDebugPaths(DEBUG_PATHS)).toBe("/home/u/.config/opencode");
  });

  it("공백이 있는 경로와 CRLF를 처리한다", () => {
    expect(parseDebugPaths("config     C:\\Users\\A B\\.config\\opencode\r\n")).toBe("C:\\Users\\A B\\.config\\opencode");
  });

  it("config 줄이 없으면 undefined", () => {
    expect(parseDebugPaths("home /home/u")).toBeUndefined();
  });
});

describe("resolveConfigDir", () => {
  it("--config-dir가 가장 우선한다", () => {
    const result = resolveConfigDir({ explicit: "/custom", run: () => DEBUG_PATHS });
    expect(result).toEqual({ dir: path.resolve("/custom"), source: "--config-dir" });
  });

  it("opencode debug paths 결과를 쓴다", () => {
    expect(resolveConfigDir({ run: () => DEBUG_PATHS }).dir).toBe("/home/u/.config/opencode");
  });

  it("opencode CLI가 없으면 XDG 규칙으로 찾는다", () => {
    const result = resolveConfigDir({ env: { XDG_CONFIG_HOME: "/xdg" }, run: () => undefined });
    expect(result.dir).toBe(path.join("/xdg", "opencode"));
  });

  it("fallbackConfigDir는 ~/.config/opencode를 기본으로 쓴다", () => {
    expect(fallbackConfigDir({}, "/home/u")).toBe(path.join("/home/u", ".config", "opencode"));
  });
});

describe("parseArgs", () => {
  it("기본은 install", () => {
    expect(parseArgs([])).toEqual({ command: "install", configDir: undefined });
  });

  it("명령과 옵션을 읽는다", () => {
    expect(parseArgs(["uninstall", "--config-dir", "/c"])).toEqual({ command: "uninstall", configDir: "/c" });
  });

  it("알 수 없는 인자나 빠진 값은 에러", () => {
    expect(() => parseArgs(["--nope"])).toThrow();
    expect(() => parseArgs(["--link"])).toThrow();
    expect(() => parseArgs(["--config-dir"])).toThrow();
  });
});
