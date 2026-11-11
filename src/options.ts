import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const CONFIG_FILE_NAME = "conditional-instructions.json";
export const ENV_PREFIX = "CONDITIONAL_INSTRUCTIONS_";

export interface Options {
  /** 플러그인 전체 활성화 여부 */
  enabled: boolean;
  /** 전역 지침 위치(`<config>/conditional-instructions/`) 사용 여부 (FR-1) */
  global: boolean;
  /** 세션 시작 디렉터리 매칭 사용 여부 (FR-5) */
  sessionStart: boolean;
  /** 지침 하나의 최대 크기(byte) (NFR-3) */
  maxBytes: number;
  /** 매칭 과정 로그 출력 여부 (NFR-5) */
  debug: boolean;
  /** `list`, `glob`, `grep` 탐색 경로도 매칭할지 여부 (FR-3) */
  searchTools: boolean;
  /** 사용자 정의 도구 이름 → 경로가 담긴 인자 이름 목록 (FR-3) */
  customTools: Record<string, string[]>;
}

export const DEFAULT_OPTIONS: Readonly<Options> = Object.freeze({
  enabled: true,
  global: true,
  sessionStart: true,
  maxBytes: 8 * 1024,
  debug: false,
  searchTools: false,
  customTools: {},
});

type Env = Record<string, string | undefined>;

export interface LoadOptionsInput {
  /** OpenCode 설정 디렉터리. 생략하면 {@link resolveConfigDir} 결과를 씁니다. */
  configDir?: string;
  /** `opencode.json`의 plugin 옵션 (`["…", { … }]` 형태로 등록한 경우) */
  pluginOptions?: Record<string, unknown> | undefined;
  env?: Env;
}

export interface LoadOptionsResult {
  options: Options;
  warnings: string[];
}

/**
 * OpenCode의 전역 설정 디렉터리를 구합니다.
 * OpenCode는 `$XDG_CONFIG_HOME/opencode`, 없으면 `~/.config/opencode`를 씁니다.
 */
export function resolveConfigDir(env: Env = process.env, home: string = homedir()): string {
  const xdg = env["XDG_CONFIG_HOME"];
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(home, ".config");
  return path.join(base, "opencode");
}

/**
 * 옵션을 읽습니다. 우선순위(높은 것부터):
 * 환경변수 → plugin 옵션 → `<config>/conditional-instructions.json` → 기본값.
 * 잘못된 값은 무시하고 경고로 돌려줍니다.
 */
export function loadOptions(input: LoadOptionsInput = {}): LoadOptionsResult {
  const env = input.env ?? process.env;
  const warnings: string[] = [];
  const options: Options = { ...DEFAULT_OPTIONS, customTools: {} };

  const configDir = input.configDir ?? resolveConfigDir(env);
  const file = path.join(configDir, CONFIG_FILE_NAME);
  const fromFile = readConfigFile(file, warnings);
  if (fromFile) applyObject(options, fromFile, file, warnings);

  if (input.pluginOptions) applyObject(options, input.pluginOptions, "plugin options", warnings);

  applyEnv(options, env, warnings);
  return { options, warnings };
}

function readConfigFile(file: string, warnings: string[]): Record<string, unknown> | undefined {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      warnings.push(`${file}: 읽을 수 없습니다 (${String(error)})`);
    }
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
    warnings.push(`${file}: 최상위 값은 객체여야 합니다`);
  } catch (error) {
    warnings.push(`${file}: JSON을 파싱할 수 없습니다 (${String(error)})`);
  }
  return undefined;
}

const BOOLEAN_KEYS = ["enabled", "global", "sessionStart", "debug", "searchTools"] as const;

function applyObject(
  options: Options,
  source: Record<string, unknown>,
  origin: string,
  warnings: string[],
): void {
  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema") continue;
    if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
      if (typeof value === "boolean") options[key as (typeof BOOLEAN_KEYS)[number]] = value;
      else warnings.push(`${origin}: "${key}"는 boolean이어야 합니다`);
    } else if (key === "maxBytes") {
      if (isPositiveInteger(value)) options.maxBytes = value;
      else warnings.push(`${origin}: "maxBytes"는 양의 정수여야 합니다`);
    } else if (key === "customTools") {
      const tools = parseCustomTools(value);
      if (tools) options.customTools = tools;
      else warnings.push(`${origin}: "customTools"는 { "도구 이름": ["인자 이름", …] } 형태여야 합니다`);
    } else {
      warnings.push(`${origin}: 알 수 없는 옵션 "${key}"`);
    }
  }
}

/** 환경변수 이름 → 옵션 키. `DISABLE`은 `enabled`를 뒤집어 적용합니다. */
const ENV_BOOLEANS: ReadonlyArray<[string, (typeof BOOLEAN_KEYS)[number], boolean]> = [
  ["DISABLE", "enabled", true],
  ["GLOBAL", "global", false],
  ["SESSION_START", "sessionStart", false],
  ["DEBUG", "debug", false],
  ["SEARCH_TOOLS", "searchTools", false],
];

function applyEnv(options: Options, env: Env, warnings: string[]): void {
  for (const [suffix, key, inverted] of ENV_BOOLEANS) {
    const name = ENV_PREFIX + suffix;
    const raw = env[name];
    if (raw === undefined || raw === "") continue;
    const value = parseBoolean(raw);
    if (value === undefined) warnings.push(`${name}: "${raw}"는 boolean으로 해석할 수 없습니다`);
    else options[key] = inverted ? !value : value;
  }

  const name = ENV_PREFIX + "MAX_BYTES";
  const raw = env[name];
  if (raw !== undefined && raw !== "") {
    const value = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (isPositiveInteger(value)) options.maxBytes = value;
    else warnings.push(`${name}: "${raw}"는 양의 정수가 아닙니다`);
  }
}

function parseBoolean(raw: string): boolean | undefined {
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return undefined;
}

function parseCustomTools(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, string[]> = {};
  for (const [tool, args] of Object.entries(value)) {
    if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) return undefined;
    result[tool] = [...args];
  }
  return result;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
