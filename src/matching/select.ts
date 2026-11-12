import type { Instruction } from "../instruction/parse.js";
import { globBase, matchesGlob } from "./glob.js";

/** worktree 기준 상대 경로와 일치하는 `paths`를 가진 지침을 고릅니다 (FR-3). */
export function selectForFile(instructions: readonly Instruction[], relativePath: string): Instruction[] {
  return instructions.filter((instruction) => instruction.paths.some((pattern) => matchesGlob(pattern, relativePath)));
}

/** `paths`가 없는 항상 적용 지침을 고릅니다 (FR-4). */
export function selectAlwaysApplied(instructions: readonly Instruction[]): Instruction[] {
  return instructions.filter((instruction) => instruction.paths.length === 0);
}

/**
 * 세션 디렉터리(worktree 기준 상대 경로, 루트는 `""`)를 대상으로 하는 지침을 고릅니다 (FR-5).
 * glob base가 비어 있지 않고, 세션 디렉터리가 base와 같거나 그 아래여야 합니다.
 */
export function selectForSessionStart(instructions: readonly Instruction[], sessionDirectory: string): Instruction[] {
  return instructions.filter(
    (instruction) =>
      instruction.sessionStart &&
      instruction.paths.some((pattern) => {
        const base = globBase(pattern);
        return base !== "" && (sessionDirectory === base || sessionDirectory.startsWith(`${base}/`));
      }),
  );
}
