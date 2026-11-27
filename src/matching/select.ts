import { homedir } from "node:os";
import type { Instruction } from "../instruction/parse.js";
import { isAbsoluteAnyStyle, isWindowsAbsolute, pathApiFor, toSlash } from "../path-style.js";
import { matchesGlob } from "./glob.js";

/**
 * 접근한 파일과 일치하는 `paths`를 가진 지침을 고릅니다 (FR-3).
 *
 * `file`은 프로젝트 디렉터리 안이면 상대 경로, 밖이면 절대 경로입니다 (`/` 구분).
 * - 상대 경로 패턴은 프로젝트 디렉터리 안의 파일과 상대 경로로 비교합니다.
 * - 절대 경로 패턴은 파일의 절대 경로와 비교하므로 프로젝트 디렉터리 밖의 파일도 매칭합니다.
 *   패턴 형식에 따라 Linux(`/…`)와 Windows(`C:\…`, `C:/…`, `\\server\share\…`)를 각각 처리합니다.
 */
export function selectForFile(
  instructions: readonly Instruction[],
  file: string,
  projectDir: string,
  home: string = homedir(),
): Instruction[] {
  const isAbsolute = isAbsoluteAnyStyle(file);
  const absolute = toSlash(isAbsolute ? file : pathApiFor(projectDir).resolve(projectDir, file));
  const relative = isAbsolute ? undefined : file;
  return instructions.filter((instruction) =>
    instruction.paths.some((pattern) => {
      const resolved = resolveAbsolutePattern(pattern, home);
      if (resolved !== undefined) return matchesGlob(resolved.glob, absolute, { nocase: resolved.windows });
      return relative !== undefined && matchesGlob(pattern, relative);
    }),
  );
}

/** `paths`가 없어 세션 시작부터 적용하는 항상 적용 지침을 고릅니다 (FR-4). */
export function selectAlwaysApplied(instructions: readonly Instruction[]): Instruction[] {
  return instructions.filter((instruction) => instruction.paths.length === 0);
}

interface AbsolutePattern {
  glob: string;
  /** Windows 경로 패턴이면 `\`를 구분자로 보고 대소문자를 구분하지 않습니다. */
  windows: boolean;
}

/** 절대 경로 패턴이면 비교할 glob을, 상대 경로 패턴이면 `undefined`를 돌려줍니다. `~`는 홈 디렉터리로 펼칩니다. */
function resolveAbsolutePattern(pattern: string, home: string): AbsolutePattern | undefined {
  // `~\`는 홈 디렉터리가 Windows 경로일 때만 구분자로 봅니다. Linux에서 `\`는 glob escape입니다.
  if (pattern === "~" || pattern.startsWith("~/") || (pattern.startsWith("~\\") && isWindowsAbsolute(home))) {
    pattern = home + pattern.slice(1);
  }
  // Windows 패턴의 `\`는 glob escape가 아니라 경로 구분자입니다.
  if (isWindowsAbsolute(pattern)) return { glob: toSlash(pattern), windows: true };
  if (pattern.startsWith("/")) return { glob: pattern, windows: false };
  return undefined;
}
