import path from "node:path";
import type { Options } from "../options.js";

export interface ToolCall {
  tool: string;
  args: unknown;
}

export interface ExtractToolPathsContext {
  worktree: string;
  options: Options;
}

const FILE_TOOLS = new Set(["read", "edit", "write"]);
const PATCH_TOOLS = new Set(["patch", "apply_patch"]);
const SEARCH_TOOLS = new Set(["list", "glob", "grep"]);
const READ_COMMANDS = new Set(["cat", "head", "tail", "less", "more", "bat"]);
/** 값을 하나 받는 옵션 (예: `head -n 20`) */
const OPTIONS_WITH_VALUE = new Set(["-n", "-c"]);

/**
 * 도구 호출이 접근한 파일 경로를 worktree 기준 상대 경로(`/` 구분)로 돌려줍니다 (FR-3).
 * worktree 밖의 경로는 버립니다.
 */
export function extractToolPaths(call: ToolCall, { worktree, options }: ExtractToolPathsContext): string[] {
  const args = isRecord(call.args) ? call.args : {};
  const raw: unknown[] = [];

  if (FILE_TOOLS.has(call.tool)) raw.push(args["filePath"]);
  else if (PATCH_TOOLS.has(call.tool)) raw.push(...patchFiles(args["patchText"]));
  else if (call.tool === "bash") raw.push(bashReadTarget(args["command"]));
  else if (SEARCH_TOOLS.has(call.tool) && options.searchTools) raw.push(args["path"]);

  for (const name of options.customTools[call.tool] ?? []) raw.push(args[name]);

  const result: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || value === "") continue;
    const relative = toWorktreeRelative(worktree, value);
    if (relative !== undefined && !result.includes(relative)) result.push(relative);
  }
  return result;
}

function patchFiles(patchText: unknown): string[] {
  if (typeof patchText !== "string") return [];
  const files: string[] = [];
  for (const line of patchText.split(/\r?\n/)) {
    const match = /^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$/.exec(line) ?? /^\*\*\* Move to: (.+?)\s*$/.exec(line);
    if (match?.[1]) files.push(match[1]);
  }
  return files;
}

/** `cat`/`head`/`tail`/`less` 등으로 단일 파일을 읽는 단순한 명령이면 그 파일을 돌려줍니다 (최선 노력). */
function bashReadTarget(command: unknown): string | undefined {
  if (typeof command !== "string" || /[|;&<>`$()]/.test(command)) return undefined;
  const [program, ...rest] = command.trim().split(/\s+/);
  if (program === undefined || !READ_COMMANDS.has(program)) return undefined;

  const operands: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (OPTIONS_WITH_VALUE.has(token)) i++;
    else if (!token.startsWith("-")) operands.push(token.replace(/^(['"])(.*)\1$/, "$2"));
  }
  return operands.length === 1 ? operands[0] : undefined;
}

function toWorktreeRelative(worktree: string, file: string): string | undefined {
  const relative = path.relative(worktree, path.resolve(worktree, file));
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
