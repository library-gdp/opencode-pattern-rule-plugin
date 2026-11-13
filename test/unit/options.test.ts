import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_FILE_NAME, DEFAULT_OPTIONS, loadOptions, resolveConfigDir } from "../../src/options.js";

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(path.join(tmpdir(), "ci-options-"));
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
});

function writeConfig(content: unknown): void {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  writeFileSync(path.join(configDir, CONFIG_FILE_NAME), text);
}

describe("resolveConfigDir", () => {
  it("XDG_CONFIG_HOME이 있으면 그 아래 opencode를 쓴다", () => {
    expect(resolveConfigDir({ XDG_CONFIG_HOME: "/xdg" }, "/home/u")).toBe(path.join("/xdg", "opencode"));
  });

  it("XDG_CONFIG_HOME이 없거나 상대 경로면 ~/.config/opencode를 쓴다", () => {
    expect(resolveConfigDir({}, "/home/u")).toBe(path.join("/home/u", ".config", "opencode"));
    expect(resolveConfigDir({ XDG_CONFIG_HOME: "rel" }, "/home/u")).toBe(path.join("/home/u", ".config", "opencode"));
  });
});

describe("loadOptions", () => {
  it("설정이 없으면 기본값을 쓴다", () => {
    const result = loadOptions({ configDir, env: {} });
    expect(result).toEqual({ options: { ...DEFAULT_OPTIONS, customTools: {} }, warnings: [] });
  });

  it("설정 파일 값을 읽는다", () => {
    writeConfig({ $schema: "x", global: false, maxBytes: 100, customTools: { mcp_read: ["file"] } });
    const { options, warnings } = loadOptions({ configDir, env: {} });
    expect(warnings).toEqual([]);
    expect(options).toMatchObject({ global: false, maxBytes: 100, customTools: { mcp_read: ["file"] } });
  });

  it("우선순위는 환경변수 > plugin 옵션 > 설정 파일이다", () => {
    writeConfig({ debug: true, searchTools: false, maxBytes: 100 });
    const { options } = loadOptions({
      configDir,
      pluginOptions: { searchTools: true, maxBytes: 200 },
      env: { CONDITIONAL_INSTRUCTIONS_MAX_BYTES: "300" },
    });
    expect(options).toMatchObject({ debug: true, searchTools: true, maxBytes: 300 });
  });

  it("DISABLE 환경변수는 enabled를 뒤집는다", () => {
    expect(loadOptions({ configDir, env: { CONDITIONAL_INSTRUCTIONS_DISABLE: "1" } }).options.enabled).toBe(false);
    writeConfig({ enabled: false });
    expect(loadOptions({ configDir, env: { CONDITIONAL_INSTRUCTIONS_DISABLE: "false" } }).options.enabled).toBe(true);
  });

  it.each([
    ["true", true],
    ["ON", true],
    ["yes", true],
    ["0", false],
    ["off", false],
  ])("boolean 환경변수 %s → %s", (raw, expected) => {
    const { options } = loadOptions({ configDir, env: { CONDITIONAL_INSTRUCTIONS_GLOBAL: raw } });
    expect(options.global).toBe(expected);
  });

  it("빈 환경변수는 무시한다", () => {
    const { options, warnings } = loadOptions({ configDir, env: { CONDITIONAL_INSTRUCTIONS_DEBUG: "" } });
    expect(options.debug).toBe(false);
    expect(warnings).toEqual([]);
  });

  it("잘못된 값은 무시하고 경고한다", () => {
    writeConfig({ global: "no", maxBytes: -1, customTools: { t: [1] }, unknown: 1 });
    const { options, warnings } = loadOptions({
      configDir,
      env: { CONDITIONAL_INSTRUCTIONS_DEBUG: "maybe", CONDITIONAL_INSTRUCTIONS_MAX_BYTES: "1.5" },
    });
    expect(options).toEqual({ ...DEFAULT_OPTIONS, customTools: {} });
    expect(warnings).toHaveLength(6);
  });

  it("JSON이 깨진 설정 파일은 경고하고 기본값을 쓴다", () => {
    writeConfig("{ not json");
    const { options, warnings } = loadOptions({ configDir, env: {} });
    expect(options.enabled).toBe(true);
    expect(warnings[0]).toContain("JSON");
  });
});
