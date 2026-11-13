import type { Instruction } from "../instruction/parse.js";
import { matchesGlob } from "./glob.js";

/** 프로젝트 디렉터리 기준 상대 경로와 일치하는 `paths`를 가진 지침을 고릅니다 (FR-3). */
export function selectForFile(instructions: readonly Instruction[], relativePath: string): Instruction[] {
  return instructions.filter((instruction) => instruction.paths.some((pattern) => matchesGlob(pattern, relativePath)));
}

/** `paths`가 없어 세션 시작부터 적용하는 항상 적용 지침을 고릅니다 (FR-4). */
export function selectAlwaysApplied(instructions: readonly Instruction[]): Instruction[] {
  return instructions.filter((instruction) => instruction.paths.length === 0);
}
